'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/content/index.js
//
//  Orchestrator — the ONLY file upstream callers import.
//  Pure. Deterministic. No I/O.
//
//  Flow (data-flow order, locked):
//    1. prepareRows(rawRows)             — attach _date/_minutes/_excluded
//    2. buildKpi(prepared)               — compute KPIs + derived facts
//    3. buildRecommendations(derived)    — fire triggers, score confidence,
//                                          split into recs vs observations
//    4. buildNarrative(derived)          — anomalyKey + 4 sentences
//    5. buildLegend(confidence)          — emitted iff low-confidence
//    6. validateReport(ctx)              — consistency guards
//
//  Note on step order: recommendations are built BEFORE narrative so
//  that S4 ("N actions listed in Recommendations…") can reference the
//  actual count. Narrative itself only reads derived numbers; it does
//  not influence recommendations.
//
//  Observations are a first-class output channel alongside
//  recommendations. They carry the same card shape but with
//  type='observation' and an "insufficient evidence" note instead of
//  an actionable step. They never escalate to recommendations.
//
//  Exports:
//    buildReportContext(rawRows, opts) → ctx
// ══════════════════════════════════════════════════════════════════

const { buildKpi, prepareRows } = require('./kpi');
const { buildRecommendations } = require('./recommendations');
const { buildNarrative } = require('./narrative');
const { validateReport } = require('./validate');

function buildLegend(confidence, lang) {
  if (!confidence || confidence.level !== 'low') return null;
  const remaining = 100 - (confidence.excludedPct || 0);
  return (lang === 'ko')
    ? `* 전체 데이터의 ${remaining}% 기준, ${confidence.excludedCount}건 제외됨`
    : `* Computed on ${remaining}% of records; ${confidence.excludedCount} rows excluded due to incomplete data.`;
}

function buildReportContext(rawRows, opts = {}) {
  const lang = (opts.lang === 'ko') ? 'ko' : 'en';
  const variant = opts.variant || 'monthlyBranch';

  // 1–2. Prepare rows, compute KPIs + derived facts ---------------
  const prepared = prepareRows(rawRows, opts);
  const kpi = buildKpi(prepared, Object.assign({}, opts, {
    variant,
    prepared: true,
  }));

  // 3. Recommendations + observations -----------------------------
  let rec = buildRecommendations(kpi.derived, {
    lang,
    period: opts.period,
    confidence: kpi.confidence,
    priorMedianResolveMin: opts.priorMedianResolveMin,
    cap: opts.cap,
  });

  // 4. Narrative --------------------------------------------------
  const narrative = buildNarrative(kpi.derived, {
    lang,
    scope: opts.scope,
    period: opts.period,
    confidence: kpi.confidence,
    recommendationCount: rec.recommendations.length,
    observationCount: rec.observations.length,
  });

  // If narrative flagged an anomaly but NEITHER a recommendation NOR
  // an observation surfaced, re-run recommendations with anomalyKey
  // context so the T13 fallback injects as an observation.
  if (rec.recommendations.length === 0
      && rec.observations.length === 0
      && narrative.anomalyKey
      && narrative.anomalyKey !== 's2.balanced'
      && narrative.anomalyKey !== 's2.empty') {
    rec = buildRecommendations(kpi.derived, {
      lang,
      period: opts.period,
      confidence: kpi.confidence,
      priorMedianResolveMin: opts.priorMedianResolveMin,
      cap: opts.cap,
      anomalyKey: narrative.anomalyKey,
    });
  }

  // 5. Confidence legend
  const confidenceLegend = buildLegend(kpi.confidence, lang);

  // Full context shape — this is what Handlebars templates will see.
  const ctx = {
    lang,
    variant,
    period: opts.period || null,
    scope: opts.scope || null,
    generated: opts.generated || null,

    labels: getLabels(lang),

    // Numeric layer
    kpis: kpi.kpis,
    confidence: kpi.confidence,
    confidenceLegend,
    excluded: kpi.excluded,
    derived: kpi.derived,

    // Narrative layer
    anomalyKey: narrative.anomalyKey,
    narrative: {
      s1: narrative.s1,
      s2: narrative.s2,
      s3: narrative.s3,
      s4: narrative.s4,
      vars: narrative.vars,
    },

    // Evidence-gated output layers
    recommendations: rec.recommendations,
    observations: rec.observations,

    _diagnostics: {
      kpi: kpi._diagnostics,
      recommendations: rec._diagnostics,
    },
  };

  // 6. Validate ---------------------------------------------------
  ctx._validation = validateReport(ctx);

  return ctx;
}

// ── Labels ───────────────────────────────────────────────────────

function getLabels(lang) {
  if (lang === 'ko') {
    return {
      title: '인시던트 운영 리포트',
      executiveSummary: '핵심 요약',
      kpiStrip: '핵심 지표',
      narrative: '운영 서술',
      recommendations: '권고 조치',
      observations: '관찰 사항',
      observed: '관찰',
      recommendedAction: '권고 조치',
      insufficientEvidence: '권고 근거 부족',
      confidenceLow: '데이터 품질 보정 필요',
      noRecommendations: '금번 주기에 해당하는 권고 조치 없음.',
    };
  }
  return {
    title: 'Incident Operations Report',
    executiveSummary: 'Executive Summary',
    kpiStrip: 'Key Metrics',
    narrative: 'Operational Narrative',
    recommendations: 'Recommendations',
    observations: 'Observations',
    observed: 'Observed',
    recommendedAction: 'Recommended action',
    insufficientEvidence: 'Insufficient evidence for action recommendation',
    confidenceLow: 'Subject to data-quality caveats',
    noRecommendations: 'No recommended actions this cycle.',
  };
}

module.exports = { buildReportContext };
