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
//  Multi-Account Authentication (ID + Password)
// ══════════════════════════════════════════════
const AUTH_SECRET = crypto.randomBytes(32).toString('hex');
function makeToken(id) { return crypto.createHmac('sha256', AUTH_SECRET).update(id || 'gto').digest('hex'); }

// Account registry: id → { pwd, branch, locale, region }
// branch=null means HQ (full access)
const ACCOUNTS = {
  gto:  { pwd: process.env.APP_PASSWORD || 'dst1234', branch: null,   locale: '',   region: null },
  amdb: { pwd: 'db1234', branch: 'AMDB', locale: 'en', region: 'global' },
  amlv: { pwd: 'lv1234', branch: 'AMLV', locale: 'en', region: 'global' },
  amny: { pwd: 'ny1234', branch: 'AMNY', locale: 'en', region: 'global' },
  amgn: { pwd: 'gn1234', branch: 'AMGN', locale: 'kr', region: 'korea' },
  amys: { pwd: 'ys1234', branch: 'AMYS', locale: 'kr', region: 'korea' },
  amjj: { pwd: 'jj1234', branch: 'AMJJ', locale: 'kr', region: 'korea' },
  ambs: { pwd: 'bs1234', branch: 'AMBS', locale: 'kr', region: 'korea' },
};

// Pre-compute valid tokens for each account
const VALID_TOKENS = {};
Object.keys(ACCOUNTS).forEach(id => { VALID_TOKENS[id] = makeToken(id); });

// Login page HTML generator — locale param for /en, /kr redirect after login
function buildLoginHTML(locale) {
  const actionUrl = '/login';
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>d'strict Error Dashboard | Login</title>
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/fonts/icon-180.png">
<meta name="theme-color" content="#534AB7">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Pretendard',-apple-system,sans-serif;background:#1a1a18;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#fff}
.login-box{background:#2a2a28;border-radius:16px;padding:48px 40px;width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
.logo-wrap{margin-bottom:24px}
.logo-text{font-size:36px;font-weight:900;color:#fff;letter-spacing:-1.5px;font-family:'Helvetica Neue',Arial,sans-serif}
.app-name{font-size:18px;font-weight:700;color:#534AB7;margin-top:8px;letter-spacing:0.5px}
.sub{font-size:12px;color:#73726c;margin-bottom:28px;margin-top:4px}
.field{width:100%;padding:14px 16px;background:#1a1a18;border:1.5px solid #3a3a38;border-radius:10px;color:#fff;font-size:15px;outline:none;transition:border-color 0.2s}
.field:focus{border-color:#534AB7}
.field::placeholder{font-size:13px;color:#555}
.field-id{text-align:center;letter-spacing:3px;text-transform:lowercase;margin-bottom:10px}
.field-pw{text-align:center;letter-spacing:8px}
.remember-row{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px}
.remember-row input[type=checkbox]{width:16px;height:16px;accent-color:#534AB7;cursor:pointer}
.remember-row label{font-size:12px;color:#888;cursor:pointer;user-select:none}
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
<form method="POST" action="${actionUrl}" id="loginForm">
<input class="field field-id" type="text" name="username" id="loginId" placeholder="ID (e.g. gto, amdb, amgn)" autofocus autocomplete="username">
<input class="field field-pw" type="password" name="password" id="loginPw" placeholder="Password" autocomplete="current-password">
<div class="remember-row">
<input type="checkbox" id="rememberMe" name="remember">
<label for="rememberMe">ID / Password 저장</label>
</div>
<button type="submit">Sign In</button>
<div class="err" id="err">ID 또는 비밀번호가 올바르지 않습니다.</div>
</form>
</div>
<script>
(function(){
  var saved=localStorage.getItem('gto_saved_creds');
  if(saved){try{var c=JSON.parse(saved);
    document.getElementById('loginId').value=c.id||'';
    document.getElementById('loginPw').value=c.pw||'';
    document.getElementById('rememberMe').checked=true;
  }catch(e){}}
  document.getElementById('loginForm').addEventListener('submit',function(){
    var cb=document.getElementById('rememberMe');
    if(cb.checked){
      localStorage.setItem('gto_saved_creds',JSON.stringify({id:document.getElementById('loginId').value,pw:document.getElementById('loginPw').value}));
    }else{localStorage.removeItem('gto_saved_creds');}
  });
  if(new URLSearchParams(location.search).has('fail'))document.getElementById('err').style.display='block';
})();
</script>
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
  const uid = (req.body.username || '').trim().toLowerCase();
  const pw = req.body.password || '';
  if (!uid || !pw || pw.length > 128) {
    return res.redirect('/login?fail=1');
  }
  const account = ACCOUNTS[uid];
  if (!account) {
    console.warn(`⚠️  Unknown account "${uid}" at ${new Date().toISOString()}`);
    return res.redirect('/login?fail=1');
  }
  // Timing-safe comparison
  const a = Buffer.from(pw.padEnd(256, '\0'));
  const b = Buffer.from(account.pwd.padEnd(256, '\0'));
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    console.log(`✅ Login [${uid}] at ${new Date().toISOString()}`);
    res.cookie('dse_auth', VALID_TOKENS[uid], COOKIE_OPTS);
    // Store account info in a non-httpOnly cookie so frontend JS can read it
    const acctInfo = JSON.stringify({ id: uid, branch: account.branch, region: account.region });
    res.cookie('dse_acct', acctInfo, { ...COOKIE_OPTS, httpOnly: false });
    // Redirect to the account's default page
    // gto (HQ) → SPA with Admin tab visible (can also access /admin standalone)
    if (uid === 'gto') return res.redirect('/kr');
    const locale = account.locale;
    if (locale === 'kr') return res.redirect('/kr');
    if (locale === 'en') return res.redirect('/en');
    return res.redirect('/');
  }
  console.warn(`⚠️  Failed login [${uid}] at ${new Date().toISOString()}`);
  res.redirect('/login?fail=1');
});
app.get('/logout', (req, res) => {
  res.clearCookie('dse_auth', { httpOnly: true, sameSite: 'lax', secure: USE_HTTPS, path: '/' });
  res.clearCookie('dse_acct', { sameSite: 'lax', secure: USE_HTTPS, path: '/' });
  res.redirect('/login');
});

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '5.7.3', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
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
app.use(express.static(PUBLIC_DIR, { maxAge: IS_PROD ? '1d' : 0, etag: true, index: false, redirect: false }));

// Auth middleware — protect pages and API (static assets already served above)
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/favicon.ico') return next();
  const authToken = req.cookies.dse_auth || '';
  const isValid = Object.values(VALID_TOKENS).some(t => t === authToken);
  if (isValid) return next();
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
    const { month, year, action, lang, reportType, region, comment, branchFilter } = req.body;
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
    // If branchFilter specified (single branch account), filter further
    const finalLogs = branchFilter && ALL_BRANCHES.includes(branchFilter)
      ? regionLogs.filter(r => r.Branch === branchFilter)
      : regionLogs;
    const safeComment = typeof comment === 'string' ? comment.slice(0, 2000) : '';
    const pdfBuffer = await generatePDF(finalLogs, month, year, safeLang, allHistory, assets, safeType, safeRegion, safeComment, branchFilter);
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
    const { year, action, lang, region, comment, branchFilter } = req.body;
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
    // branchFilter: 지점 계정이 자신의 지점만 리포트 생성할 때
    const finalAnnualLogs = branchFilter && ALL_BRANCHES.includes(branchFilter)
      ? regionLogs.filter(r => r.Branch === branchFilter)
      : regionLogs;
    const safeAnnualComment = typeof comment === 'string' ? comment.slice(0, 2000) : '';
    const pdfBuffer = await generateAnnualPDF(finalAnnualLogs, year, safeLang, allHistory, assets, safeRegion, safeAnnualComment);
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
//  /admin — GTO Admin Dashboard (gto account only)
// ══════════════════════════════════════════════
app.get('/admin', (req, res) => {
  // Check if logged in as gto
  const authToken = req.cookies.dse_auth || '';
  if (authToken !== VALID_TOKENS['gto']) {
    // If logged in as another account, redirect to their page; else login
    const isAnyValid = Object.values(VALID_TOKENS).some(t => t === authToken);
    return isAnyValid ? res.redirect('/') : res.redirect('/login');
  }
  const fs = require('fs');
  // Try public/admin.html first, then root admin.html
  const adminPath = fs.existsSync(path.join(PUBLIC_DIR, 'admin.html'))
    ? path.join(PUBLIC_DIR, 'admin.html')
    : path.join(__dirname, 'admin.html');
  if (fs.existsSync(adminPath)) {
    res.sendFile(adminPath);
  } else {
    res.status(404).send('Admin page not found');
  }
});


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
const server = app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  validateConfig();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => process.exit(0));
});