'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/context.js
//  View-model builders. Each builder returns a plain-object context
//  consumed by a Handlebars template. No rendering or I/O here.
//
//  Exports:
//    buildSmokeContext(opts)          → smoke-test view-model
//    buildMonthlyBranchContext(rows, opts) → monthlyBranch ctx
//    buildMonthlyGlobalContext(rows, opts) → monthlyGlobal ctx
//    buildAnnualContext(rows, opts)   → annual ctx
// ══════════════════════════════════════════════════════════════════

const { buildReportContext } = require('./content/index');

// ── Locale helpers ───────────────────────────────────────────────

const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTHS_KO = [
  '1월','2월','3월','4월','5월','6월',
  '7월','8월','9월','10월','11월','12월',
];

function fmtDate(d, lang) {
  return new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-GB', {
    year: 'numeric', month: 'short', day: '2-digit',
  }).format(d);
}

function periodLabel(month, year, lang) {
  // month is 0-based
  return lang === 'ko'
    ? `${year}년 ${MONTHS_KO[month]}`
    : `${MONTHS_EN[month]} ${year}`;
}

// KPI accent derivation — based on semantic tag from content pipeline.
function kpiAccent(kpi) {
  if (kpi.semantic === 'severity_critical') {
    const share = kpi.share;
    if (share == null) return 'brand';
    return share >= 0.15 ? 'crit' : (share >= 0.08 ? 'warn' : 'ok');
  }
  if (kpi.semantic === 'median_resolve') {
    const v = kpi.value;
    if (v == null) return 'brand';
    return v > 120 ? 'crit' : (v > 60 ? 'warn' : 'ok');
  }
  if (kpi.semantic === 'reporting_completeness') {
    const v = kpi.value;
    if (v == null) return 'brand';
    return v < 0.75 ? 'crit' : (v < 0.85 ? 'warn' : 'ok');
  }
  return 'brand';
}

// Enrich kpis from content pipeline with accent + (ko) label overrides.
function enrichKpis(kpis) {
  return kpis.map(k => Object.assign({}, k, { accent: kpiAccent(k) }));
}

// ── Core builder ─────────────────────────────────────────────────
//
// Takes raw rows (normLog format: Branch, Zone, Date, Time, TimeTaken,
// Category, ActionTaken, Difficulty, Severity) and opts, runs the v2
// content pipeline, then layers on template-layer fields.

function buildV2Context(rows, opts = {}) {
  const lang     = opts.lang === 'ko' ? 'ko' : 'en';
  const variant  = opts.variant || 'monthlyBranch';
  const period   = opts.period  || '';
  const scope    = opts.scope   || null;
  const now      = opts.now     || new Date();
  const generated = opts.generated || fmtDate(now, lang);

  // Run content pipeline
  const ctx = buildReportContext(rows, {
    lang,
    variant,
    period,
    scope,
    generated,
    priorMedianResolveMin: opts.priorMedianResolveMin || null,
  });

  // Enrich KPIs with visual accent tokens
  const kpis = enrichKpis(ctx.kpis || []);

  // KPI column count: 5 for monthlyBranch (K1-K5), 6 for global/annual
  const kpiColumns = kpis.length >= 6 ? '6' : (kpis.length >= 4 ? '5' : String(kpis.length));

  // Doc title for <title> element
  const titleParts = [
    lang === 'ko' ? '에러 리포트' : 'Error Report',
    scope || (lang === 'ko' ? '전체' : 'All Branches'),
    period,
  ].filter(Boolean);
  const docTitle = `${titleParts.join(' · ')} — d'strict GTO`;

  return Object.assign({}, ctx, {
    kpis,
    kpiColumns,
    docTitle,
    generated,
    period,
    scope,
    // labels already provided by buildReportContext but need page label added
    labels: Object.assign({ page: lang === 'ko' ? '페이지' : 'Page' }, ctx.labels),
  });
}

// ── Public builders ──────────────────────────────────────────────

function buildMonthlyBranchContext(rows, opts = {}) {
  return buildV2Context(rows, Object.assign({}, opts, { variant: 'monthlyBranch' }));
}

function buildMonthlyGlobalContext(rows, opts = {}) {
  return buildV2Context(rows, Object.assign({}, opts, { variant: 'monthlyGlobal' }));
}

function buildAnnualContext(rows, opts = {}) {
  return buildV2Context(rows, Object.assign({}, opts, { variant: 'annual' }));
}

// ── Smoke-test context (unchanged from original) ─────────────────

const SMOKE_LABELS = {
  en: { period: 'Period', scope: 'Scope', generated: 'Generated', version: 'Version',
        executiveSummary: 'Executive Summary', snapshot: 'Operational snapshot', page: 'Page' },
  ko: { period: '기간', scope: '범위', generated: '생성일', version: '버전',
        executiveSummary: '경영 요약', snapshot: '운영 스냅샷', page: '페이지' },
};

const SMOKE_COPY = {
  en: {
    eyebrow:  'd\u2019strict · Global Tech Ops',
    headline: 'Smoke Test — HTML/CSS Reporting Engine',
    subhead:  'Layout, typography, grid, pagination, and bilingual font loading verified end-to-end.',
    orgLine:  'Global Tech Operations',
    narrative:
      'This page confirms the v2 reporting pipeline is rendering with a real layout engine: ' +
      'fonts load via <strong>@font-face</strong>, KPIs are placed on a CSS grid, and page breaks ' +
      'are driven by <strong>@page</strong> rules rather than manual y-coordinate accounting. ' +
      'Subsequent iterations will replace the monthly and annual PDFKit reports with composable ' +
      'sections built on this foundation.',
  },
  ko: {
    eyebrow:  'd\u2019strict · Global Tech Ops',
    headline: '스모크 테스트 — HTML/CSS 리포팅 엔진',
    subhead:  '레이아웃, 타이포그래피, 그리드, 페이지네이션, 이중 언어 폰트 로딩을 엔드-투-엔드로 검증합니다.',
    orgLine:  'Global Tech Operations',
    narrative:
      'v2 리포팅 파이프라인이 실제 레이아웃 엔진 위에서 동작함을 확인하는 페이지입니다. ' +
      '폰트는 <strong>@font-face</strong>로 로드되고 KPI는 CSS 그리드에 배치되며, 페이지 분할은 ' +
      '수동 좌표 계산이 아닌 <strong>@page</strong> 규칙이 주도합니다. ' +
      '다음 단계부터 월간/연간 PDFKit 리포트를 이 기반 위의 모듈형 섹션으로 교체합니다.',
  },
};

function buildSmokeContext({ lang = 'en', now = new Date() } = {}) {
  const L = SMOKE_LABELS[lang] || SMOKE_LABELS.en;
  const T = SMOKE_COPY[lang]   || SMOKE_COPY.en;
  return {
    lang,
    docTitle: `${T.headline} — d'strict GTO`,
    labels: L,
    eyebrow:   T.eyebrow,
    headline:  T.headline,
    subhead:   T.subhead,
    orgLine:   T.orgLine,
    narrative: T.narrative,
    meta: {
      period:    fmtDate(now, lang),
      scope:     lang === 'ko' ? '전체 지사' : 'All branches',
      generated: fmtDate(now, lang),
      version:   'v2.0-alpha',
    },
    kpis: [
      { accent: 'brand', label: lang === 'ko' ? '전체 인시던트' : 'Total Incidents', value: '1,248', hint: lang === 'ko' ? '전년 대비 +8%' : '+8% YoY' },
      { accent: 'crit',  label: lang === 'ko' ? '중대 (Lv 4+)'  : 'Critical (Lv 4+)', value: '37', hint: lang === 'ko' ? '전년 대비 −12%' : '−12% YoY' },
      { accent: 'ok',    label: lang === 'ko' ? '평균 해결 시간' : 'Avg Resolution', value: '42', unit: lang === 'ko' ? '분' : 'min', hint: lang === 'ko' ? '목표 60분 이내' : 'SLA: <60 min' },
      { accent: 'warn',  label: lang === 'ko' ? '평균 난이도'    : 'Avg Difficulty', value: '2.3', unit: '/5', hint: lang === 'ko' ? '중간 수준' : 'Moderate' },
      { accent: 'brand', label: lang === 'ko' ? '가동률'         : 'Availability', value: '99.82', unit: '%', hint: lang === 'ko' ? '목표 99.5%' : 'Target 99.5%' },
    ],
  };
}

module.exports = {
  buildSmokeContext,
  buildMonthlyBranchContext,
  buildMonthlyGlobalContext,
  buildAnnualContext,
  buildV2Context,
  // exposed for scripts
  _helpers: { periodLabel, fmtDate, enrichKpis },
};
