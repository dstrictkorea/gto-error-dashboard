'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');

// Import modules
const { C, MONTHS_EN, ALL_BRANCHES, KOREA_BRANCHES, GLOBAL_BRANCHES, BR_NAMES, BR_COLORS, validateConfig } = require('./config');
const { getToken, getSheet } = require('./auth');
const { fg, normLog, normAsset, normHist } = require('./normalize');
const { router: aiRouter } = require('./ai');
const { generatePDF } = require('./pdf');
const { generateAnnualPDF } = require('./pdf-annual');

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://dskr-gto.duckdns.org' : true),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// ══════════════════════════════════════════════
//  Request Logging — lightweight access log
// ══════════════════════════════════════════════
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (!req.path.match(/\.(js|css|otf|png|ico)$/)) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
});

// ══════════════════════════════════════════════
//  Rate Limiting — API 남용 방지
// ══════════════════════════════════════════════
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute window
  max: 60,                    // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minute window
  max: 100,                    // 100 login attempts per 5 min (global branches share IP)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});
app.use('/api/', apiLimiter);
app.use('/login', authLimiter);

// ══════════════════════════════════════════════
//  CSRF Protection — Origin check for POST requests
// ══════════════════════════════════════════════
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  // Allow if no origin header (same-origin form submit from browser)
  if (!origin) return next();
  // Extract hostname from origin URL and compare to host (exact match, not substring)
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return next();
  } catch(e) { console.warn('Malformed origin header:', e.message); }
  console.warn(`⚠️  CSRF blocked: origin=${origin} host=${host} path=${req.path}`);
  return res.status(403).json({ error: 'Forbidden — origin mismatch' });
});

// ══════════════════════════════════════════════
//  Password Authentication (simple token-cookie)
// ══════════════════════════════════════════════
const APP_PASSWORD = process.env.APP_PASSWORD || '1234';  // Change in .env for production
const AUTH_SECRET = crypto.randomBytes(32).toString('hex');
function makeToken() { return crypto.createHmac('sha256', AUTH_SECRET).update(APP_PASSWORD).digest('hex'); }
const VALID_TOKEN = makeToken();

// Login page HTML generator — locale param for /en, /kr redirect after login
function buildLoginHTML(locale) {
  const localeField = locale ? `<input type="hidden" name="locale" value="${locale}">` : '';
  const actionUrl = locale ? `/login?locale=${locale}` : '/login';
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>d'strict Error Dashboard | Login</title>
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/fonts/icon-180.png">
<meta name="theme-color" content="#534AB7">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Pretendard',-apple-system,sans-serif;background:#1a1a18;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#fff}
.login-box{background:#2a2a28;border-radius:16px;padding:48px 40px;width:380px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
.logo-wrap{margin-bottom:24px}
.logo-text{font-size:36px;font-weight:900;color:#fff;letter-spacing:-1.5px;font-family:'Helvetica Neue',Arial,sans-serif}
.app-name{font-size:18px;font-weight:700;color:#534AB7;margin-top:8px;letter-spacing:0.5px}
.sub{font-size:12px;color:#73726c;margin-bottom:28px;margin-top:4px}
input{width:100%;padding:14px 16px;background:#1a1a18;border:1.5px solid #3a3a38;border-radius:10px;color:#fff;font-size:15px;text-align:center;letter-spacing:8px;outline:none;transition:border-color 0.2s}
input:focus{border-color:#534AB7}
input::placeholder{letter-spacing:normal;font-size:13px;color:#555}
button{width:100%;margin-top:16px;padding:14px;background:#534AB7;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:background 0.2s}
button:hover{background:#4339a0}
.err{color:#e53e3e;font-size:12px;margin-top:12px;display:none}
.bar{position:absolute;top:0;left:0;right:0;height:4px;background:#534AB7}
.divider{width:40px;height:2px;background:#534AB7;margin:0 auto 6px}
</style></head><body>
<div class="bar"></div>
<div class="login-box">
<div class="logo-wrap">
<div class="logo-text">d'strict</div>
<div class="divider"></div>
<div class="app-name">Error Dashboard</div>
</div>
<div class="sub">Global Technical Operations</div>
<form method="POST" action="${actionUrl}">
${localeField}<input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
<button type="submit">Sign In</button>
<div class="err" id="err">Incorrect password. Please try again.</div>
</form>
</div>
<script>if(new URLSearchParams(location.search).has('fail'))document.getElementById('err').style.display='block'</script>
<script>if('serviceWorker' in navigator){var loc='${locale}';if(loc==='en')navigator.serviceWorker.register('/en/sw.js',{scope:'/en'});else if(loc==='kr')navigator.serviceWorker.register('/kr/sw.js',{scope:'/kr'});else navigator.serviceWorker.register('/sw.js');}</script>
</body></html>`;
}
const LOGIN_HTML = buildLoginHTML('');

// Cookie parser (lightweight, no dependency) — must be before auth
app.use((req, res, next) => {
  if (!req.cookies) {
    req.cookies = {};
    const raw = req.headers.cookie || '';
    raw.split(';').forEach(c => {
      const eq = c.indexOf('=');
      if (eq < 1) return;
      const k = c.substring(0, eq).trim();
      const v = c.substring(eq + 1).trim();
      if (k && /^[\w\-.]+$/.test(k)) req.cookies[k] = decodeURIComponent(v || '');
    });
  }
  next();
});

const IS_PROD = process.env.NODE_ENV === 'production';
const USE_HTTPS = process.env.USE_HTTPS === 'true';  // Only enable secure cookie when HTTPS is configured
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', secure: USE_HTTPS, path: '/', maxAge: 60 * 60 * 1000 }; // 1-hour persistent cookie → survives PWA background/tab switch

// Auth routes (no middleware applied)
app.get('/login', (req, res) => {
  const locale = req.query.locale || '';
  res.type('html').send(locale ? buildLoginHTML(locale) : LOGIN_HTML);
});
app.post('/login', (req, res) => {
  const pw = req.body.password;
  if (typeof pw !== 'string' || pw.length === 0 || pw.length > 128) {
    return res.redirect('/login?fail=1');
  }
  // Timing-safe comparison to prevent timing attacks
  const a = Buffer.from(pw.padEnd(256, '\0'));
  const b = Buffer.from(APP_PASSWORD.padEnd(256, '\0'));
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    console.log(`✅ Login at ${new Date().toISOString()}`);
    res.cookie('dse_auth', VALID_TOKEN, COOKIE_OPTS);
    // Redirect to the locale path if specified, otherwise /
    const locale = req.query.locale || req.body.locale || '';
    if (locale === 'kr') return res.redirect('/kr');
    if (locale === 'en') return res.redirect('/en');
    return res.redirect('/');
  }
  console.warn(`⚠️  Failed login attempt at ${new Date().toISOString()}`);
  const locale = req.query.locale || req.body.locale || '';
  res.redirect('/login?fail=1' + (locale ? '&locale=' + locale : ''));
});
app.get('/logout', (req, res) => { res.clearCookie('dse_auth', { httpOnly: true, sameSite: 'lax', secure: USE_HTTPS, path: '/' }); res.redirect('/login'); });

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '5.1.2', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

// ══════════════════════════════════════════════
//  Security Headers (CSP, X-Frame, etc.)
// ══════════════════════════════════════════════
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
  next();
});

// ── Service-Worker-Allowed header for scoped SWs ──
app.get('/en/sw.js', (req, res, next) => { res.setHeader('Service-Worker-Allowed', '/en'); next(); });
app.get('/kr/sw.js', (req, res, next) => { res.setHeader('Service-Worker-Allowed', '/kr'); next(); });

// ── Static assets BEFORE auth — JS/CSS/images/fonts served without login ──
// index: false prevents serving index.html for '/' — that stays behind auth
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: IS_PROD ? '1d' : 0, etag: true, index: false }));

// Auth middleware — protect pages and API (static assets already served above)
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/favicon.ico') return next();
  if (req.cookies.dse_auth === VALID_TOKEN) return next();
  // API requests get 401, page requests redirect to login with locale
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  // Preserve locale on redirect to login
  if (req.path === '/kr') return res.redirect('/login?locale=kr');
  if (req.path === '/en') return res.redirect('/login?locale=en');
  res.redirect('/login');
});

// ══════════════════════════════════════════════
//  /api/data — SharePoint data fetch
// ══════════════════════════════════════════════
app.get('/api/data', async (req, res) => {
  const t0 = Date.now();
  try {
    console.log('\n📡 SharePoint 데이터 요청 (Table_HQ + Past_History + Asset_List)...');
    const results = await Promise.allSettled([
      getSheet(C.sheets.hq), getSheet(C.sheets.history), getSheet(C.sheets.assets)
    ]);
    // Graceful partial failure: if hq fails, throw; history/assets can be empty
    if (results[0].status === 'rejected') throw results[0].reason;
    const hq = results[0].value;
    const hist = results[1].status === 'fulfilled' ? results[1].value : [];
    const assetRaw = results[2].status === 'fulfilled' ? results[2].value : [];
    if (results[1].status === 'rejected') console.warn('⚠️  History fetch failed:', results[1].reason.message);
    if (results[2].status === 'rejected') console.warn('⚠️  Assets fetch failed:', results[2].reason.message);

    // All logs come from Table_HQ — branch is extracted from each row
    const logs = hq.map(r => {
      const branch = String(fg(r,'Branch','branch','Site','Location')).toUpperCase();
      const validBranch = ALL_BRANCHES.includes(branch) ? branch : 'AMGN';
      return normLog(r, validBranch);
    }).filter(r=>r.Zone||r.IssueDetail);

    // History = Past_History (separate resolved cases archive)
    const allHistory = hist.map(normHist).filter(h=>h.zone||h.detail);
    const assets = assetRaw.map(normAsset).filter(a=>a.Name);

    const ms = Date.now()-t0;
    console.log(`✅ logs ${logs.length} (from Table_HQ), history ${allHistory.length}, assets ${assets.length} (${ms}ms)`);
    res.json({ logs, history: allHistory, assets,
      meta:{ lastSync:new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),
        counts:{logs:logs.length,history:allHistory.length,assets:assets.length}, elapsed:`${ms}ms` }
    });
  } catch(e) {
    console.error('❌',e.message);
    const code = e.message.includes('Graph 401') || e.message.includes('AADSTS') ? 401
      : e.message.includes('Graph 403') ? 403
      : e.message.includes('Graph 404') ? 404
      : e.name === 'AbortError' ? 504
      : 500;
    const errMsg = IS_PROD
      ? { 401:'Authentication failed.', 403:'Access denied.', 404:'Resource not found.', 504:'Request timed out.' }
      : { 401:'SharePoint authentication failed. Check Azure credentials.',
          403:'Access denied. Check SharePoint permissions.',
          404:'SharePoint resource not found. Check Drive/File IDs.',
          504:'SharePoint request timed out. Try again.' };
    res.status(code).json({ error: errMsg[code] || (IS_PROD ? 'Service error.' : 'Data fetch failed. Check server logs.') });
  }
});

// ══════════════════════════════════════════════
//  /api/status — Auth check
// ══════════════════════════════════════════════
app.get('/api/status', async (req,res) => {
  try { await getToken(); res.json({ok:true}); }
  catch(e) {
    const code = e.name === 'AbortError' ? 504 : e.message.includes('AADSTS') ? 401 : 500;
    res.status(code).json({ok:false,error:e.message});
  }
});

// ══════════════════════════════════════════════
//  AI Routes (mounted from ai.js)
// ══════════════════════════════════════════════
app.use('/api', aiRouter);

// ══════════════════════════════════════════════
//  /api/report — PDF generation
// ══════════════════════════════════════════════
app.post('/api/report', async (req, res) => {
  const t0 = Date.now();
  try {
    const { month, year, action, lang, reportType, region } = req.body;
    const validActions = ['download', 'preview', 'email'];
    const validLangs = ['en', 'ko'];
    const validTypes = ['monthly', 'annual'];
    const validRegions = ['korea', 'global'];
    if (!validActions.includes(action)) return res.status(400).json({ error: 'Invalid action' });
    if (typeof month !== 'number' || month < 0 || month > 11) return res.status(400).json({ error: 'Invalid month' });
    if (typeof year !== 'number' || year < 2000 || year > 2100) return res.status(400).json({ error: 'Invalid year' });
    const safeLang = validLangs.includes(lang) ? lang : 'en';
    const safeType = validTypes.includes(reportType) ? reportType : 'monthly';
    const safeRegion = validRegions.includes(region) ? region : 'global';
    const regionBranches = safeRegion === 'korea' ? KOREA_BRANCHES : GLOBAL_BRANCHES;
    console.log(`\n📄 Report: ${MONTHS_EN[month]} ${year} (${action}) lang=${safeLang} type=${safeType} region=${safeRegion}`);

    const [hq, hist, assetRaw] = await Promise.all([
      getSheet(C.sheets.hq), getSheet(C.sheets.history), getSheet(C.sheets.assets)
    ]);

    // All logs from Table_HQ (same logic as /api/data)
    const logs = hq.map(r => {
      const branch = String(fg(r,'Branch','branch','Site','Location')).toUpperCase();
      const validBranch = ALL_BRANCHES.includes(branch) ? branch : 'AMGN';
      return normLog(r, validBranch);
    }).filter(r => r.Zone || r.IssueDetail);

    const allHistory = hist.map(normHist).filter(h=>h.zone||h.detail);
    const assets = assetRaw.map(normAsset).filter(a=>a.Name);

    const regionLogs = logs.filter(r => regionBranches.includes(r.Branch));
    const pdfBuffer = await generatePDF(regionLogs, month, year, safeLang, allHistory, assets, safeType, safeRegion);
    const pdfBase64 = pdfBuffer.toString('base64');
    const mm = String(month + 1).padStart(2, '0');
    const langTag = safeLang === 'ko' ? '(KOR)' : '(ENG)';
    const regionTag = safeRegion === 'korea' ? 'Korea' : 'Global';
    const fileName = `${langTag}_${regionTag}_${mm}${year}_Monthly Error Report.pdf`;
    const ms = Date.now() - t0;
    console.log(`✅ PDF: ${fileName} (${(pdfBuffer.length/1024).toFixed(0)}KB, ${ms}ms)`);

    res.json({
      ok: true, action: action || 'download',
      fileName, pdfBase64, size: pdfBuffer.length,
      message: `${fileName} (${(pdfBuffer.length/1024).toFixed(0)}KB)`
    });
  } catch (e) {
    console.error('❌ Report error:', e.message);
    res.status(500).json({ error: 'Report generation failed. Check server logs.' });
  }
});

// ══════════════════════════════════════════════
//  /api/annual-report — Annual PDF generation
// ══════════════════════════════════════════════
app.post('/api/annual-report', async (req, res) => {
  const t0 = Date.now();
  try {
    const { year, action, lang, region } = req.body;
    const validActions = ['download', 'preview', 'email'];
    const validLangs = ['en', 'ko'];
    const validRegions = ['korea', 'global'];
    if (!validActions.includes(action)) return res.status(400).json({ error: 'Invalid action' });
    if (typeof year !== 'number' || year < 2000 || year > 2100) return res.status(400).json({ error: 'Invalid year' });
    const safeLang = validLangs.includes(lang) ? lang : 'en';
    const safeRegion = validRegions.includes(region) ? region : 'global';
    const regionBranches = safeRegion === 'korea' ? KOREA_BRANCHES : GLOBAL_BRANCHES;
    console.log(`\n📄 Annual Report: ${year} (${action}) lang=${safeLang} region=${safeRegion}`);

    const [hq, hist, assetRaw] = await Promise.all([
      getSheet(C.sheets.hq), getSheet(C.sheets.history), getSheet(C.sheets.assets)
    ]);

    const logs = hq.map(r => {
      const branch = String(fg(r,'Branch','branch','Site','Location')).toUpperCase();
      const validBranch = ALL_BRANCHES.includes(branch) ? branch : 'AMGN';
      return normLog(r, validBranch);
    }).filter(r => r.Zone || r.IssueDetail);

    const allHistory = hist.map(normHist).filter(h=>h.zone||h.detail);
    const assets = assetRaw.map(normAsset).filter(a=>a.Name);

    const regionLogs = logs.filter(r => regionBranches.includes(r.Branch));
    const pdfBuffer = await generateAnnualPDF(regionLogs, year, safeLang, allHistory, assets, safeRegion);
    const pdfBase64 = pdfBuffer.toString('base64');
    const langTag = safeLang === 'ko' ? '(KOR)' : '(ENG)';
    const regionTag = safeRegion === 'korea' ? 'Korea' : 'Global';
    const fileName = `${langTag}_${regionTag}_${year}_Annual Error Report.pdf`;
    const ms = Date.now() - t0;
    console.log(`✅ Annual PDF: ${fileName} (${(pdfBuffer.length/1024).toFixed(0)}KB, ${ms}ms)`);

    res.json({
      ok: true, action: action || 'download',
      fileName, pdfBase64, size: pdfBuffer.length,
      message: `${fileName} (${(pdfBuffer.length/1024).toFixed(0)}KB)`
    });
  } catch (e) {
    console.error('❌ Annual Report error:', e.message);
    res.status(500).json({ error: 'Annual report generation failed. Check server logs.' });
  }
});

// ══════════════════════════════════════════════
//  Error Handling — API 404 (MUST come BEFORE SPA fallback)
// ══════════════════════════════════════════════
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

// ══════════════════════════════════════════════
//  SPA fallback (static already served above auth middleware)
// ══════════════════════════════════════════════
// Form app — separate SPA
app.get('/form', (req,res) => res.sendFile(path.join(PUBLIC_DIR, 'form', 'index.html')));
app.get('/form/*', (req,res) => {
  const filePath = path.resolve(path.join(PUBLIC_DIR, req.path));
  // Prevent path traversal — ensure resolved path stays inside PUBLIC_DIR
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR))) return res.status(403).send('Forbidden');
  res.sendFile(filePath, err => { if(err && !res.headersSent) res.sendFile(path.join(PUBLIC_DIR, 'form', 'index.html')); });
});
// Locale-specific routes — serve index.html with locale manifest/SW injected
app.get('/en', (req,res) => {
  const fs = require('fs');
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  html = html.replace('href="/manifest.json"', 'href="/en/manifest.json"');
  html = html.replace("register('/sw.js')", "register('/en/sw.js',{scope:'/en'})");
  res.type('html').send(html);
});
app.get('/kr', (req,res) => {
  const fs = require('fs');
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  html = html.replace('href="/manifest.json"', 'href="/kr/manifest.json"');
  html = html.replace("register('/sw.js')", "register('/kr/sw.js',{scope:'/kr'})");
  res.type('html').send(html);
});
// Main dashboard SPA fallback
app.get('*', (req,res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: IS_PROD ? 'Internal server error' : err.message });
});

// ══════════════════════════════════════════════
//  Server startup
// ══════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

// ── SERVER START (pm2 managed) ──
const server = app.listen(PORT, async () => {
  console.log(`\n🚀 d'strict Error Dashboard v5.5.0 → http://localhost:${PORT} (PID ${process.pid})`);
  console.log('📊 SharePoint Excel 연동 (페이지 접속/새로고침 시 로드)\n');
  validateConfig();
  try { await getToken(); console.log('✅ Azure AD 인증 완료\n'); }
  catch(e) { console.error('⚠️  인증 실패:',e.message,'\n   → AZURE_SECRET을 확인하세요\n'); }
});

server.on('error', function(err) {
  console.error('❌ 서버 시작 실패:', err.code, err.message);
  process.exit(1);
});

// Graceful shutdown (pm2 sends SIGINT)
function shutdown(sig) {
  console.log(`\n${sig} received — shutting down… (PID ${process.pid})`);
  server.close(() => { console.log('Server closed'); process.exit(0); });
  setTimeout(() => process.exit(1), 10000);
}
process.on('SIGTERM', function() { shutdown('SIGTERM'); });
process.on('SIGINT', function() { shutdown('SIGINT'); });
process.on('uncaughtException', function(err) {
  console.error('Uncaught exception:', err);
  process.exit(1);
});
