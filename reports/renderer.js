'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/renderer.js
//  HTML (Handlebars template + view-model) → PDF (Puppeteer/Chromium)
//
//  Design:
//    · One long-lived Chromium instance (launched on first render).
//    · Each render writes a fresh run directory under the OS temp,
//      links styles/ and fonts/ relative to it, and points
//      page.goto() at file://<runDir>/index.html so @font-face and
//      <link href="./styles/*.css"> resolve with zero URL rewriting.
//    · Deterministic cleanup after render (even on error paths).
//
//  Public API:
//    renderPdf({ template, data }) → Promise<Buffer>
//    closeRenderer()              → Promise<void>
// ══════════════════════════════════════════════════════════════════

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');

// ── Paths ────────────────────────────────────────────────────────
const REPORTS_DIR   = __dirname;
const TEMPLATES_DIR = path.join(REPORTS_DIR, 'templates');
const PARTIALS_DIR  = path.join(TEMPLATES_DIR, 'partials');
const STYLES_DIR    = path.join(REPORTS_DIR, 'styles');
const FONTS_SRC_DIR = path.join(REPORTS_DIR, '..', 'public', 'fonts');

// ── Template cache ───────────────────────────────────────────────
const _templateCache = new Map();

function loadTemplate(name) {
  if (_templateCache.has(name)) return _templateCache.get(name);
  const file = path.join(TEMPLATES_DIR, `${name}.hbs`);
  const src = fs.readFileSync(file, 'utf8');
  const compiled = Handlebars.compile(src, { noEscape: false });
  _templateCache.set(name, compiled);
  return compiled;
}

function loadLayout() {
  return loadTemplate('layout');
}

// ── Register partials once per process ───────────────────────────
let _partialsRegistered = false;
function registerPartialsOnce() {
  if (_partialsRegistered) return;
  if (!fs.existsSync(PARTIALS_DIR)) {
    _partialsRegistered = true;
    return;
  }
  const files = fs.readdirSync(PARTIALS_DIR).filter(f => f.endsWith('.hbs'));
  for (const f of files) {
    const name = path.basename(f, '.hbs');
    const src = fs.readFileSync(path.join(PARTIALS_DIR, f), 'utf8');
    Handlebars.registerPartial(name, src);
  }
  _partialsRegistered = true;
}

// ── Handlebars helpers ───────────────────────────────────────────
Handlebars.registerHelper('eq',  (a, b) => a === b);
Handlebars.registerHelper('ne',  (a, b) => a !== b);
Handlebars.registerHelper('gt',  (a, b) => Number(a) > Number(b));
Handlebars.registerHelper('lt',  (a, b) => Number(a) < Number(b));
Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
Handlebars.registerHelper('or',  function () {
  // Last arg is Handlebars options; drop it before folding
  const args = Array.prototype.slice.call(arguments, 0, -1);
  return args.some(v => !!v);
});
Handlebars.registerHelper('default', (v, fallback) => {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return fallback;
  return v;
});
// Split an observed blob on newlines — used by card-combined.hbs
Handlebars.registerHelper('splitLines', (str) => {
  if (typeof str !== 'string' || str.length === 0) return [];
  return str.split(/\r?\n/).filter(l => l.length > 0);
});
// Strip a leading "· " bullet so CSS owns bullet presentation
Handlebars.registerHelper('stripBullet', (line) => {
  if (typeof line !== 'string') return '';
  return line.replace(/^\s*·\s*/, '').trim();
});
Handlebars.registerHelper('startsWith', (str, prefix) => {
  return typeof str === 'string' && typeof prefix === 'string' && str.indexOf(prefix) === 0;
});
Handlebars.registerHelper('fmtNum', (n) => {
  if (n === null || n === undefined || n === '') return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString('en-US');
});

// ══════════════════════════════════════════════════════════════════
//  Chromium — launched on demand, reused across renders
// ══════════════════════════════════════════════════════════════════
let _browserPromise = null;

function getBrowser() {
  if (_browserPromise) return _browserPromise;
  _browserPromise = puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',     // stability on containers / small VMs
      '--font-render-hinting=none',  // kerning consistent across OS
    ],
  }).catch(err => {
    _browserPromise = null;
    throw err;
  });
  return _browserPromise;
}

async function closeRenderer() {
  const b = _browserPromise;
  _browserPromise = null;
  if (!b) return;
  try { const browser = await b; await browser.close(); } catch (_) { /* ignore */ }
}

// Optional eager warmup — call from server startup so the first user
// request does not pay the Chromium launch cost (~2–8s cold).
async function warmup() {
  await Promise.all([ getBrowser(), getAssetsDir() ]);
}

// ══════════════════════════════════════════════════════════════════
//  Asset cache — styles/ and fonts/ are copied ONCE per process into
//  a stable temp dir. Each render writes a per-request HTML file
//  alongside the cached assets so `./styles/*.css` and `./fonts/*.otf`
//  keep resolving with zero URL rewriting.
//
//  Why a copy instead of a symlink: Windows requires elevated privs
//  for directory symlinks. Copy is one-off (~50ms–200ms) and happens
//  at process start, not per request.
// ══════════════════════════════════════════════════════════════════
let _assetsDirPromise = null;

async function getAssetsDir() {
  if (_assetsDirPromise) return _assetsDirPromise;
  _assetsDirPromise = (async () => {
    const dir = path.join(os.tmpdir(), `gto-report-assets-${process.pid}`);
    await fsp.mkdir(dir, { recursive: true });
    // Always (re)populate on process start — cheap, and keeps the cache
    // in sync with on-disk style/font edits across restarts.
    await copyDir(STYLES_DIR, path.join(dir, 'styles'));
    await copyDir(FONTS_SRC_DIR, path.join(dir, 'styles', 'fonts'));
    return dir;
  })().catch(err => {
    _assetsDirPromise = null;
    throw err;
  });
  return _assetsDirPromise;
}

async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  await Promise.all(entries.map(async (e) => {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) return copyDir(s, d);
    return fsp.copyFile(s, d);
  }));
}

async function cleanupHtml(htmlPath) {
  if (!htmlPath) return;
  try { await fsp.unlink(htmlPath); } catch (_) { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════════
//  Connection-error detection
//  Puppeteer throws "Connection closed" / "Target closed" when the
//  Chromium process crashes or is restarted while the Node process
//  still holds a stale browser promise.  Detect these so callers
//  can reset _browserPromise and retry.
// ══════════════════════════════════════════════════════════════════
function isConnectionError(err) {
  if (!err || typeof err.message !== 'string') return false;
  const msg = err.message;
  return (
    msg.includes('Connection closed') ||
    msg.includes('Target closed')     ||
    msg.includes('Session closed')    ||
    msg.includes('Protocol error')    ||
    msg.includes('detached')
  );
}

// ══════════════════════════════════════════════════════════════════
//  Core HTML build — shared by renderPdf and renderImg
// ══════════════════════════════════════════════════════════════════
async function buildHtml(template, data) {
  registerPartialsOnce();
  const bodyTpl   = loadTemplate(template);
  const layoutTpl = loadLayout();
  const body = bodyTpl(data);
  return layoutTpl({ ...data, body });
}

// ══════════════════════════════════════════════════════════════════
//  Internal render — opens a page, loads HTML, calls cb(page)
//  Returns whatever cb returns.  Cleans up on success AND error.
// ══════════════════════════════════════════════════════════════════
async function _withPage(htmlPath, cb) {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    const url = 'file:///' + htmlPath.replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    return await cb(page);
  } finally {
    if (page) { try { await page.close(); } catch (_) { /* ignore */ } }
    await cleanupHtml(htmlPath);
  }
}

// ══════════════════════════════════════════════════════════════════
//  PDF render
//
//  opts.template  — handlebars template name under reports/templates
//  opts.data      — view-model passed to template + layout
//  opts.pdf       — optional overrides for page.pdf() options
// ══════════════════════════════════════════════════════════════════
async function _renderPdfOnce({ template, data, pdf: pdfOpts = {} }) {
  const assetsDir = await getAssetsDir();
  const htmlPath  = path.join(assetsDir, `r-${crypto.randomBytes(6).toString('hex')}.html`);
  const html = await buildHtml(template, data);
  await fsp.writeFile(htmlPath, html, 'utf8');
  return _withPage(htmlPath, (page) => page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,   // @page in CSS is authoritative for size
    displayHeaderFooter: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }, // CSS owns margins
    ...pdfOpts,
  }));
}

async function renderPdf(opts = {}) {
  if (!opts.template) throw new Error('renderPdf: template is required');
  if (!opts.data || typeof opts.data !== 'object') throw new Error('renderPdf: data object is required');
  try {
    return await _renderPdfOnce(opts);
  } catch (err) {
    if (isConnectionError(err)) {
      // Stale Chromium — reset promise so getBrowser() re-launches
      _browserPromise = null;
      console.warn('[renderer] Puppeteer connection lost, retrying…');
      return await _renderPdfOnce(opts);
    }
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════
//  Image render (JPEG screenshot, full-page)
//
//  Uses screen media (not print) so @page rules / page-breaks are
//  ignored — content renders as a single continuous column.
//  Viewport width = A4 landscape px width at 96dpi (1123px) × 2
//  for crisp Retina-quality output.
// ══════════════════════════════════════════════════════════════════
async function _renderImgOnce({ template, data }) {
  const assetsDir = await getAssetsDir();
  const htmlPath  = path.join(assetsDir, `r-${crypto.randomBytes(6).toString('hex')}.html`);
  const html = await buildHtml(template, data);
  await fsp.writeFile(htmlPath, html, 'utf8');
  return _withPage(htmlPath, async (page) => {
    // Screen media: disables @page, page-break-after, etc.
    await page.emulateMediaType('screen');
    // A4 landscape width at 96 dpi = 1123px; ×2 scale for hi-res
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
    // Re-navigate so the viewport change takes effect on layout
    const url = 'file:///' + htmlPath.replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    return page.screenshot({ type: 'jpeg', quality: 92, fullPage: true });
  });
}

async function renderImg(opts = {}) {
  if (!opts.template) throw new Error('renderImg: template is required');
  if (!opts.data || typeof opts.data !== 'object') throw new Error('renderImg: data object is required');
  try {
    return await _renderImgOnce(opts);
  } catch (err) {
    if (isConnectionError(err)) {
      _browserPromise = null;
      console.warn('[renderer] Puppeteer connection lost, retrying (img)…');
      return await _renderImgOnce(opts);
    }
    throw err;
  }
}

module.exports = {
  renderPdf,
  renderImg,
  warmup,
  closeRenderer,
  // exported for tests / introspection
  _internals: { loadTemplate, getAssetsDir, cleanupHtml, registerPartialsOnce, Handlebars },
};
