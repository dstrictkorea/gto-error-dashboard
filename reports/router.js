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

const { renderPdf, renderImg } = require('./renderer');
const { buildSmokeContext, buildMonthlyBranchContext,
        buildMonthlyGlobalContext, buildAnnualContext,
        buildSystemMonthlyContext } = require('./context');

// SharePoint data access — same imports as server.js v1 endpoints.
// Router imports them directly so it stays self-contained.
const { getSheet }     = require('../auth');
const { normLog, fg }  = require('../normalize');
const {
  C, ALL_BRANCHES, KOREA_BRANCHES, GLOBAL_BRANCHES,
} = require('../config');

const router = express.Router();

// ── PDF options helper — Puppeteer footer ────────────────────────
function buildPdfOpts(generated) {
  const dateStr = (generated || '').replace(/</g, '').replace(/>/g, '');
  return {
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:0 12mm;font-size:8.5pt;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#9ca3af;box-sizing:border-box"><span>${dateStr}</span><span>Page <span class="pageNumber"></span></span></div>`,
    margin: { top: '0', right: '0', bottom: '22px', left: '0' },
  };
}

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

    // Optional free-text comment from admin UI
    const comment = req.query.comment ? String(req.query.comment).slice(0, 2000) : null;

    const generated = new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB');
    const rows = await fetchRows(month, year, branch, null);
    const ctx  = buildMonthlyBranchContext(rows, {
      lang, period: periodLabel, scope, comment, generated,
    });

    const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const tag = (branch || 'DSKR-GTO');
    const fileName = `${tag}-Monthly Error Report_${MONTH_ABBR[month]}${String(year).slice(2)}.pdf`;

    const pdf = await renderPdf({ template: 'monthly-branch', data: ctx, pdf: buildPdfOpts(generated) });
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
      || (region === 'korea'
        ? (lang === 'ko' ? '국내 지점' : 'KR Branches')
        : (lang === 'ko' ? '전체 지점' : 'All Branches'));

    const periodLabel = lang === 'ko'
      ? `${year}년 ${MONTHS_KO[month]}`
      : `${MONTHS_EN[month]} ${year}`;

    const comment = req.query.comment ? String(req.query.comment).slice(0, 2000) : null;

    const generated = new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB');
    const rows = await fetchRows(month, year, null, regionBranches);
    const ctx  = buildMonthlyGlobalContext(rows, {
      lang, period: periodLabel, scope, comment, generated,
    });

    const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const fileName = `DSKR-GTO-Monthly Error Report_${MONTH_ABBR[month]}${String(year).slice(2)}.pdf`;

    const pdf = await renderPdf({ template: 'monthly-global', data: ctx, pdf: buildPdfOpts(generated) });
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
      || (region === 'korea'
        ? (lang === 'ko' ? '국내 지점' : 'KR Branches')
        : (lang === 'ko' ? '전체 지점' : 'All Branches'));

    const periodLabel = lang === 'ko' ? `${year}년` : String(year);

    const comment = req.query.comment ? String(req.query.comment).slice(0, 2000) : null;

    // Annual: fetch all months (month=null skips month filter)
    const generated = new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB');
    const rows = await fetchRows(null, year, branch, regionBranches);
    const ctx  = buildAnnualContext(rows, {
      lang, period: periodLabel, scope, comment, generated,
    });

    const fileName = `DSKR-GTO-Annual Error Report_${String(year).slice(2)}.pdf`;

    const pdf = await renderPdf({ template: 'annual', data: ctx, pdf: buildPdfOpts(generated) });
    console.log(`[v2/annual] ${fileName} rows=${rows.length} recs=${ctx.recommendations.length} obs=${ctx.observations.length} ${Date.now()-t0}ms`);
    sendPdf(res, pdf, fileName, download, Date.now() - t0);
  } catch (e) {
    console.error('[v2/annual] error:', e);
    res.status(500).json({ error: 'annual render failed', detail: e.message });
  }
});

// ── /api/v2/system-monthly (POST) ────────────────────────────
// Body: { state: <formState>, lang, branch, month, year }
// Returns application/pdf — same visual style as Error Reports.
router.post('/system-monthly', async (req, res) => {
  const t0 = Date.now();
  try {
    const { state: formState, lang: rawLang, branch: rawBranch, month: rawMonth, year: rawYear } = req.body || {};
    if (!formState || !formState.groups) return res.status(400).json({ error: 'state.groups required' });

    const lang   = rawLang === 'ko' ? 'ko' : 'en';
    const branch = (typeof rawBranch === 'string') ? rawBranch.toUpperCase().slice(0, 10) : '';
    const year   = parseInt(rawYear, 10) || new Date().getFullYear();
    const monthIdx = parseInt(rawMonth, 10);
    const ko = lang === 'ko';

    const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const period = (isFinite(monthIdx) && monthIdx >= 0 && monthIdx <= 11)
      ? (ko ? `${year}년 ${MONTHS_KO[monthIdx]}` : `${MONTHS_EN[monthIdx]} ${year}`)
      : String(year);

    const generated = new Date().toLocaleDateString(ko ? 'ko-KR' : 'en-GB');
    const KO_SITE_NAMES = { AMGN:'아르떼뮤지엄 강릉', AMYS:'아르떼뮤지엄 여수', AMBS:'아르떼뮤지엄 부산', AMJJ:'아르떼뮤지엄 제주' };
    const koSiteName = KO_SITE_NAMES[branch];
    const title = ko && koSiteName
      ? `${koSiteName} ${isFinite(monthIdx) && monthIdx >= 0 && monthIdx <= 11 ? MONTHS_KO[monthIdx] : ''} ${year}년 시스템팀 월말 마감 보고서`
      : (branch
          ? `${branch} ${period} System Team Monthly Closing Report`
          : `${period} System Team Monthly Closing Report`);

    const ctx = buildSystemMonthlyContext(formState, { lang, period, scope: branch, title, generated });

    const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const mAbbr = (isFinite(monthIdx) && monthIdx >= 0 && monthIdx <= 11) ? MONTH_ABBR[monthIdx] : String(year);
    const fileName = `${branch || 'GTO'}-System_Team_Monthly_Closing_Report_${mAbbr}${String(year).slice(2)}.pdf`;

    // Custom PDF opts for system-monthly: proper chrome header on every page
    const _esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const siteDisp = _esc(ctx.meta && ctx.meta.site ? ctx.meta.site : ctx.scope);
    const reportLabel = ko ? '시스템팀 월말 마감 보고서' : 'System Team Monthly Closing Report';
    // Use Noto Sans CJK KR (now installed on server) so Korean renders in header/footer.
    // D&#x27;STRICT uses the safe ASCII apostrophe (U+0027) to avoid glyph-mapping bugs
    // with the curved right-single-quote in fallback fonts on Linux.
    // ── Header / Footer templates ──────────────────────────────────────────
    // Puppeteer stretches the top-level element to fill the full margin area
    // (height = margin.top).  A single-div approach with border-bottom causes
    // the border to land exactly at the content boundary → strikethrough effect.
    //
    // Fix: two-div wrapper pattern
    //  • outer div  — fills 100% of the margin height, flex-column
    //  • inner div  — the visible header bar, pinned to the TOP (justify-content:flex-start)
    //                 Its border-bottom is therefore at ~27px, well above the 55px content start.
    // Same pattern for the footer, but inner div pinned to BOTTOM with border-top.
    //
    // font-size:0 on the outer div prevents inherited font-size from creating phantom height.
    const sysHeader = `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-start;box-sizing:border-box;font-size:0"><div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:5px 12mm;border-bottom:2px solid #534AB7;font-family:'Noto Sans CJK KR','Noto Sans KR','Malgun Gothic',Arial,sans-serif;font-size:8.5pt;color:#73726c;box-sizing:border-box;line-height:1.3"><span style="font-weight:700;color:#534AB7;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap">D&#x27;STRICT &middot; GTO</span><span style="flex:1;text-align:center;padding:0 8px">${_esc(ctx.scope)} &middot; ${_esc(ctx.period)} &middot; ${reportLabel}</span><span style="white-space:nowrap">${siteDisp}</span></div></div>`;
    const sysFooter = `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;box-sizing:border-box;font-size:0"><div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:4px 12mm;border-top:1px solid #d1d5db;font-size:7.5pt;font-family:'Noto Sans CJK KR',Arial,sans-serif;color:#9ca3af;box-sizing:border-box">${_esc(generated)}<span>Page <span class="pageNumber"></span></span></div></div>`;
    const sysPdfOpts = {
      displayHeaderFooter: true,
      headerTemplate: sysHeader,
      footerTemplate: sysFooter,
      // margin.top must be > rendered header height (~27px).  55px gives ~28px breathing room.
      // margin.bottom must be > rendered footer height (~22px).  30px is sufficient.
      margin: { top: '55px', right: '0', bottom: '30px', left: '0' },
    };
    const pdf = await renderPdf({ template: 'system-monthly', data: ctx, pdf: sysPdfOpts });
    console.log(`[v2/system-monthly] ${fileName} groups=${ctx.groups.length} ${Date.now()-t0}ms`);
    sendPdf(res, pdf, fileName, true, Date.now() - t0);
  } catch (e) {
    console.error('[v2/system-monthly] error:', e);
    res.status(500).json({ error: 'system-monthly render failed', detail: e.message });
  }
});

// ── /api/v2/system-monthly-img (POST) ────────────────────────
// Same body as system-monthly. Returns JPEG screenshot (screen media,
// fullPage) instead of PDF — no page breaks, no header/footer bands.
router.post('/system-monthly-img', async (req, res) => {
  const t0 = Date.now();
  try {
    const { state: formState, lang: rawLang, branch: rawBranch, month: rawMonth, year: rawYear } = req.body || {};
    if (!formState || !formState.groups) return res.status(400).json({ error: 'state.groups required' });

    const lang   = rawLang === 'ko' ? 'ko' : 'en';
    const branch = (typeof rawBranch === 'string') ? rawBranch.toUpperCase().slice(0, 10) : '';
    const year   = parseInt(rawYear, 10) || new Date().getFullYear();
    const monthIdx = parseInt(rawMonth, 10);
    const ko = lang === 'ko';

    const _MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const _MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const period = (isFinite(monthIdx) && monthIdx >= 0 && monthIdx <= 11)
      ? (ko ? `${year}년 ${_MONTHS_KO[monthIdx]}` : `${_MONTHS_EN[monthIdx]} ${year}`)
      : String(year);

    const generated = new Date().toLocaleDateString(ko ? 'ko-KR' : 'en-GB');
    const KO_SITE_NAMES = { AMGN:'아르떼뮤지엄 강릉', AMYS:'아르떼뮤지엄 여수', AMBS:'아르떼뮤지엄 부산', AMJJ:'아르떼뮤지엄 제주' };
    const koSiteName = KO_SITE_NAMES[branch];
    const title = ko && koSiteName
      ? `${koSiteName} ${isFinite(monthIdx) && monthIdx >= 0 && monthIdx <= 11 ? _MONTHS_KO[monthIdx] : ''} ${year}년 시스템팀 월말 마감 보고서`
      : (branch
          ? `${branch} ${period} System Team Monthly Closing Report`
          : `${period} System Team Monthly Closing Report`);

    const ctx = buildSystemMonthlyContext(formState, { lang, period, scope: branch, title, generated });

    const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const mAbbr = (isFinite(monthIdx) && monthIdx >= 0 && monthIdx <= 11) ? MONTH_ABBR[monthIdx] : String(year);
    const fileName = `${branch || 'GTO'}-System_Team_Monthly_Closing_Report_${mAbbr}${String(year).slice(2)}.jpg`;

    const img = await renderImg({ template: 'system-monthly', data: ctx });
    console.log(`[v2/system-monthly-img] ${fileName} groups=${ctx.groups.length} ${Date.now()-t0}ms`);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', img.length);
    res.setHeader('X-Render-ms', String(Date.now() - t0));
    res.end(img);
  } catch (e) {
    console.error('[v2/system-monthly-img] error:', e);
    res.status(500).json({ error: 'system-monthly-img render failed', detail: e.message });
  }
});

module.exports = router;
