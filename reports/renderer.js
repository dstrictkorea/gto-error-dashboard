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
//  Main render
//
//  opts.template  — handlebars template name under reports/templates
//  opts.data      — view-model passed to template + layout
//  opts.pdf       — optional overrides for page.pdf() options
// ══════════════════════════════════════════════════════════════════
async function renderPdf({ template, data, pdf: pdfOpts = {} } = {}) {
  if (!template) throw new Error('renderPdf: template is required');
  if (!data || typeof data !== 'object') throw new Error('renderPdf: data object is required');

  const assetsDir = await getAssetsDir();
  const htmlPath = path.join(assetsDir, `r-${crypto.randomBytes(6).toString('hex')}.html`);
  let page;
  try {
    // Ensure partials are registered before first compile
    registerPartialsOnce();

    // Compose body → layout
    const bodyTpl   = loadTemplate(template);
    const layoutTpl = loadLayout();
    const body = bodyTpl(data);
    const html = layoutTpl({ ...data, body });

    // Write per-render HTML inside the shared assets dir so relative
    // ./styles/*.css and ./styles/fonts/*.otf resolve without rewriting.
    await fsp.writeFile(htmlPath, html, 'utf8');

    const browser = await getBrowser();
    page = await browser.newPage();

    const url = 'file:///' + htmlPath.replace(/\\/g, '/');
    // 'load' fires once the main HTML + linked CSS + @font-face sources
    // have been fetched. Fonts are file:// local; there is no network
    // activity to idle out, so networkidle0 only adds its 500ms window.
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

    // Authoritative font-ready signal — pairs with font-display:block.
    await page.evaluate(() => document.fonts && document.fonts.ready);

    const buffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,   // @page in CSS is authoritative
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }, // CSS owns margins
      ...pdfOpts,
    });

    return buffer;
  } finally {
    if (page) { try { await page.close(); } catch (_) { /* ignore */ } }
    await cleanupHtml(htmlPath);
  }
}

module.exports = {
  renderPdf,
  warmup,
  closeRenderer,
  // exported for tests / introspection
  _internals: { loadTemplate, getAssetsDir, cleanupHtml, registerPartialsOnce, Handlebars },
};
