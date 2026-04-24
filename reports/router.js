'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/router.js
//  v2 PDF endpoints. Mounted by server.js at /api/v2.
//
//  Endpoints:
//    GET /api/v2/health              — liveness check
//    GET /api/v2/smoke               — full pipeline smoke PDF
//    GET /api/v2/monthly-branch      — branch monthly report
//    GET /api/v2/monthly-global      — all-branch monthly report
//    GET /api/v2/annual              — annual report
//
//  All report endpoints:
//    ?lang=en|ko          — output language (default en)
//    ?month=0..11         — 0-based month (monthly only)
//    ?year=2020..2030     — calendar year
//    ?scope=AMGN          — scope label in header
//    ?branch=AMGN         — filter rows to a single branch
//    ?download=1          — Content-Disposition: attachment
//
//  Returns application/pdf bytes directly (not JSON+base64) so the
//  endpoint is curl/browser-friendly for dev validation.
// ══════════════════════════════════════════════════════════════════

const express = require('express');
const path    = require('path');

const { renderPdf }  = require('./renderer');
const { buildSmokeContext, buildMonthlyBranchContext,
        buildMonthlyGlobalContext, buildAnnualContext } = require('./context');

// SharePoint data access — same imports as server.js v1 endpoints.
// Router imports them directly so it stays self-contained.
const { getSheet }     = require('../auth');
const { normLog, fg }  = require('../normalize');
const {
  C, ALL_BRANCHES, KOREA_BRANCHES, GLOBAL_BRANCHES,
} = require('../config');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────

const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTHS_KO = [
  '1월','2월','3월','4월','5월','6월',
  '7월','8월','9월','10월','11월','12월',
];

function validLang(v)   { return v === 'ko' ? 'ko' : 'en'; }
function validMonth(v)  { const n = parseInt(v, 10); return (isFinite(n) && n >= 0 && n <= 11) ? n : null; }
function validYear(v)   { const n = parseInt(v, 10); return (isFinite(n) && n >= 2020 && n <= 2030) ? n : null; }
function validBranch(v) { return (typeof v === 'string' && ALL_BRANCHES.includes(v.toUpperCase())) ? v.toUpperCase() : null; }

function sendPdf(res, buf, fileName, download, renderMs) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${fileName}"`);
  res.setHeader('Content-Length', buf.length);
  if (renderMs != null) res.setHeader('X-Render-ms', String(renderMs));
  res.end(buf);
}

// ── Shared SharePoint fetch ───────────────────────────────────────
// Returns { logs } — rows in normLog format, filtered by period and scope.

async function fetchRows(month, year, branchFilter, regionBranches) {
  const [hq] = await Promise.all([ getSheet(C.sheets.hq) ]);
  const all = hq.map(r => {
    const branch = String(fg(r, 'Branch','branch','Site','Location')).toUpperCase();
    const validB = ALL_BRANCHES.includes(branch) ? branch : 'AMGN';
    return normLog(r, validB);
  }).filter(r => r.Zone || r.IssueDetail);

  // Region filter
  const regionFiltered = regionBranches
    ? all.filter(r => regionBranches.includes(r.Branch))
    : all;

  // Branch filter (single-branch account)
  const branchFiltered = branchFilter
    ? regionFiltered.filter(r => r.Branch === branchFilter)
    : regionFiltered;

  // Period filter (by year or year+month)
  const periodFiltered = branchFiltered.filter(r => {
    if (!r.Date) return false;
    const d = new Date(r.Date);
    if (isNaN(d.getTime())) return false;
    if (d.getFullYear() !== year) return false;
    if (month != null && d.getMonth() !== month) return false;
    return true;
  });

  return periodFiltered;
}

// ── /api/v2/health ────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ ok: true, system: 'reports-v2', ts: new Date().toISOString() });
});

// ── /api/v2/smoke ─────────────────────────────────────────────────
router.get('/smoke', async (req, res) => {
  const t0 = Date.now();
  try {
    const lang     = validLang(req.query.lang);
    const download = req.query.download === '1' || req.query.download === 'true';
    const ctx = buildSmokeContext({ lang });
    const pdf = await renderPdf({ template: 'smoke', data: ctx });
    sendPdf(res, pdf, `smoke-v2-${lang}.pdf`, download, Date.now() - t0);
  } catch (e) {
    console.error('[v2/smoke] render error:', e);
    res.status(500).json({ error: 'v2 smoke render failed', detail: e.message });
  }
});

// ── /api/v2/monthly-branch ────────────────────────────────────────
router.get('/monthly-branch', async (req, res) => {
  const t0 = Date.now();
  try {
    const lang   = validLang(req.query.lang);
    const month  = validMonth(req.query.month);
    const year   = validYear(req.query.year);
    const branch = validBranch(req.query.branch);
    const download = req.query.download === '1';

    if (month === null) return res.status(400).json({ error: 'month required (0–11)' });
    if (year  === null) return res.status(400).json({ error: 'year required (2020–2030)' });

    const scope = req.query.scope
      || branch
      || (lang === 'ko' ? '해당 지점' : 'Branch');

    const periodLabel = lang === 'ko'
      ? `${year}년 ${MONTHS_KO[month]}`
      : `${MONTHS_EN[month]} ${year}`;

    const rows = await fetchRows(month, year, branch, null);
    const ctx  = buildMonthlyBranchContext(rows, {
      lang, period: periodLabel, scope,
      generated: new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB'),
    });

    const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const tag = (branch || 'DSKR-GTO');
    const fileName = `${tag}-Monthly Error Report_${MONTH_ABBR[month]}${String(year).slice(2)}.pdf`;

    const pdf = await renderPdf({ template: 'monthly-branch', data: ctx });
    console.log(`[v2/monthly-branch] ${fileName} rows=${rows.length} recs=${ctx.recommendations.length} obs=${ctx.observations.length} ${Date.now()-t0}ms`);
    sendPdf(res, pdf, fileName, download, Date.now() - t0);
  } catch (e) {
    console.error('[v2/monthly-branch] error:', e);
    res.status(500).json({ error: 'monthly-branch render failed', detail: e.message });
  }
});

// ── /api/v2/monthly-global ────────────────────────────────────────
router.get('/monthly-global', async (req, res) => {
  const t0 = Date.now();
  try {
    const lang    = validLang(req.query.lang);
    const month   = validMonth(req.query.month);
    const year    = validYear(req.query.year);
    const region  = req.query.region === 'korea' ? 'korea' : 'global';
    const download = req.query.download === '1';

    if (month === null) return res.status(400).json({ error: 'month required (0–11)' });
    if (year  === null) return res.status(400).json({ error: 'year required (2020–2030)' });

    const regionBranches = region === 'korea' ? KOREA_BRANCHES : GLOBAL_BRANCHES;
    const scope = req.query.scope
      || (lang === 'ko' ? '전체 지사' : 'All Branches');

    const periodLabel = lang === 'ko'
      ? `${year}년 ${MONTHS_KO[month]}`
      : `${MONTHS_EN[month]} ${year}`;

    const rows = await fetchRows(month, year, null, regionBranches);
    const ctx  = buildMonthlyGlobalContext(rows, {
      lang, period: periodLabel, scope,
      generated: new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB'),
    });

    const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const fileName = `DSKR-GTO-Monthly Error Report_${MONTH_ABBR[month]}${String(year).slice(2)}.pdf`;

    const pdf = await renderPdf({ template: 'monthly-global', data: ctx });
    console.log(`[v2/monthly-global] ${fileName} rows=${rows.length} recs=${ctx.recommendations.length} obs=${ctx.observations.length} ${Date.now()-t0}ms`);
    sendPdf(res, pdf, fileName, download, Date.now() - t0);
  } catch (e) {
    console.error('[v2/monthly-global] error:', e);
    res.status(500).json({ error: 'monthly-global render failed', detail: e.message });
  }
});

// ── /api/v2/annual ────────────────────────────────────────────────
router.get('/annual', async (req, res) => {
  const t0 = Date.now();
  try {
    const lang   = validLang(req.query.lang);
    const year   = validYear(req.query.year);
    const region = req.query.region === 'korea' ? 'korea' : 'global';
    const branch = validBranch(req.query.branch);
    const download = req.query.download === '1';

    if (year === null) return res.status(400).json({ error: 'year required (2020–2030)' });

    const regionBranches = region === 'korea' ? KOREA_BRANCHES : GLOBAL_BRANCHES;
    const scope = req.query.scope
      || branch
      || (lang === 'ko' ? '전체 지사' : 'All Branches');

    const periodLabel = lang === 'ko' ? `${year}년` : String(year);

    // Annual: fetch all months (month=null skips month filter)
    const rows = await fetchRows(null, year, branch, regionBranches);
    const ctx  = buildAnnualContext(rows, {
      lang, period: periodLabel, scope,
      generated: new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB'),
    });

    const fileName = `DSKR-GTO-Annual Error Report_${String(year).slice(2)}.pdf`;

    const pdf = await renderPdf({ template: 'annual', data: ctx });
    console.log(`[v2/annual] ${fileName} rows=${rows.length} recs=${ctx.recommendations.length} obs=${ctx.observations.length} ${Date.now()-t0}ms`);
    sendPdf(res, pdf, fileName, download, Date.now() - t0);
  } catch (e) {
    console.error('[v2/annual] error:', e);
    res.status(500).json({ error: 'annual render failed', detail: e.message });
  }
});

module.exports = router;
