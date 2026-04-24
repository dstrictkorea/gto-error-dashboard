'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/context.js
//  View-model builders. Each builder returns a plain-object context
//  consumed by a Handlebars template. No rendering logic here; no
//  knowledge of Puppeteer or Express.
//
//  Step 1 scope: smoke-test builder only. Monthly/annual builders
//  will be added in subsequent steps.
// ══════════════════════════════════════════════════════════════════

// Locale dictionaries — kept inline and small. Central i18n layer can
// be extracted once the second/third template lands.
const LABELS = {
  en: {
    period:           'Period',
    scope:            'Scope',
    generated:        'Generated',
    version:          'Version',
    executiveSummary: 'Executive Summary',
    snapshot:         'Operational snapshot',
    page:             'Page',
  },
  ko: {
    period:           '기간',
    scope:            '범위',
    generated:        '생성일',
    version:          '버전',
    executiveSummary: '경영 요약',
    snapshot:         '운영 스냅샷',
    page:             '페이지',
  },
};

const COPY = {
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

// ── Public: build smoke-test context ─────────────────────────────
function buildSmokeContext({ lang = 'en', now = new Date() } = {}) {
  const L = LABELS[lang] || LABELS.en;
  const T = COPY[lang]   || COPY.en;

  const fmtDate = (d, lc) =>
    new Intl.DateTimeFormat(lc === 'ko' ? 'ko-KR' : 'en-GB', {
      year: 'numeric', month: 'short', day: '2-digit',
    }).format(d);

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
    // KPI strip — representative sample values, each accent demonstrating
    // the semantic variants (brand / ok / warn / crit / neutral).
    kpis: [
      { accent: 'brand', label: lang === 'ko' ? '전체 인시던트' : 'Total Incidents', value: '1,248',                         hint: lang === 'ko' ? '전년 대비 +8%'    : '+8% YoY' },
      { accent: 'crit',  label: lang === 'ko' ? '중대 (Lv 4+)'  : 'Critical (Lv 4+)', value: '37',                             hint: lang === 'ko' ? '전년 대비 −12%'   : '−12% YoY' },
      { accent: 'ok',    label: lang === 'ko' ? '평균 해결 시간' : 'Avg Resolution',   value: '42', unit: lang === 'ko' ? '분' : 'min', hint: lang === 'ko' ? '목표 60분 이내' : 'SLA: <60 min' },
      { accent: 'warn',  label: lang === 'ko' ? '평균 난이도'    : 'Avg Difficulty',   value: '2.3', unit: '/5',                hint: lang === 'ko' ? '중간 수준'       : 'Moderate' },
      { accent: 'brand', label: lang === 'ko' ? '가동률'          : 'Availability',    value: '99.82', unit: '%',              hint: lang === 'ko' ? '목표 99.5%'      : 'Target 99.5%' },
    ],
  };
}

module.exports = { buildSmokeContext };
