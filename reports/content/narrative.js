'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/content/narrative.js
//
//  Rule-based, deterministic. No AI. No randomness.
//  Consumes kpi.derived; never re-reads rows.
//
//  Slot contract — exactly 4 sentences:
//    S1  Period totals + critical count         (always)
//    S2  Primary anomaly (exactly one)          (strict priority ladder)
//    S3  Context detail                         (category + resolve + confidence note)
//    S4  Action outlook                         (recommendation count or all-clear)
//
//  Hard limits: ≤25 EN words per sentence, Korean mirrors scale equivalently.
//
//  Exports:
//    buildNarrative(derived, opts) → { s1, s2, s3, s4, anomalyKey, vars }
//    selectS2(derived) → { key }
//    _thresholds
// ══════════════════════════════════════════════════════════════════

// Thresholds — single source of truth; mirrored by recommendation triggers.
const TH = {
  zeroCount: 0,
  criticalHighShare: 0.15,
  slowResolveMin: 120,
  lowCompleteness: 0.85,
  categoryDominance: 0.35,
  zoneDominance: 0.30,
  // Friction-signal thresholds — must match TH_FRICTION in recommendations.js.
  // ALL THREE must be active (AND gate) before frictionSignal fires.
  frictionMinSampleCount: 20,
  frictionHighDifficultyShare: 0.25,
  frictionMedianResolveMin: 90,
  frictionRecurrenceDays: 3,
  frictionRecurrenceMin: 3,
};

// ── S2 priority ladder (strict — first match wins) ───────────────
//  1. empty period              — no data; supersedes everything
//  2. criticalHigh              — severity-based ONLY (Severity field)
//  3. frictionSignal            — no-severity fallback, observational
//  4. slowResolve               — operational risk beats shape
//  5. lowCompleteness           — reporting discipline gap (NOT SLA)
//  6. categoryDominance         — category concentration
//  7. zoneDominance             — zone concentration (Global/Annual only)
//  8. balanced                  — default
//
// SAFETY: s2.criticalHigh uses d.criticalShare which is Severity-backed
// in kpi.js — null when no Severity data. Difficulty CANNOT fire this rung.

function firesFriction(d) {
  // Must match TH_FRICTION AND gate in recommendations.js.
  // All three conditions required — single-condition triggers are disallowed.
  if (!d || d.hasSeverityData) return false;
  if (!d.totalCount || d.totalCount < TH.frictionMinSampleCount) return false;
  const hd  = d.highDifficultyShare != null && d.highDifficultyShare >= TH.frictionHighDifficultyShare;
  const res = d.medianResolveMin != null && d.medianResolveMin >= TH.frictionMedianResolveMin;
  const hdEv = d.evidence && d.evidence.highDifficulty;
  const rec = !!(hdEv && hdEv.distinctDays >= TH.frictionRecurrenceDays && hdEv.n >= TH.frictionRecurrenceMin);
  return hd && res && rec;
}

function selectS2(d) {
  if (!d || d.totalCount === TH.zeroCount) return { key: 's2.empty' };
  if (d.criticalShare != null && d.criticalShare >= TH.criticalHighShare) return { key: 's2.criticalHigh' };
  if (firesFriction(d)) return { key: 's2.frictionSignal' };
  if (d.medianResolveMin != null && d.medianResolveMin > TH.slowResolveMin) return { key: 's2.slowResolve' };
  if (d.reportingCompleteness != null && d.reportingCompleteness < TH.lowCompleteness) return { key: 's2.lowCompleteness' };
  if (d.topCategoryShare != null && d.topCategoryShare >= TH.categoryDominance) return { key: 's2.categoryDominance' };
  if ((d.variant === 'monthlyGlobal' || d.variant === 'annual')
      && d.topZoneShare != null && d.topZoneShare >= TH.zoneDominance) return { key: 's2.zoneDominance' };
  return { key: 's2.balanced' };
}

// ── Sentence templates ───────────────────────────────────────────

const TPL = {
  en: {
    s1(v) {
      const plural = v.totalCount === 1 ? '' : 's';
      const hd = v.highDifficultyCount > 0
        ? `, including ${fmtInt(v.highDifficultyCount)} high-difficulty report${v.highDifficultyCount === 1 ? '' : 's'}`
        : '';
      return `${v.scope} logged ${fmtInt(v.totalCount)} incident${plural}${v.periodTail}${hd}.`;
    },
    's2.empty'()            { return `No qualifying incident records were ingested for this period.`; },
    's2.criticalHigh'(v)    { return `Critical incidents reached ${v.criticalSharePct}% of volume, above the 15% escalation threshold.`; },
    's2.frictionSignal'(v)  { return `Reported handling difficulty and resolution patterns suggest operational strain; severity classification is not available in this dataset.`; },
    's2.slowResolve'(v)     { return `Median resolution time is ${v.medianResolveMin} minutes, exceeding the 120-minute review threshold.`; },
    's2.lowCompleteness'(v) { return `Reporting completeness is ${v.completenessPct}%, below the 85% baseline — action or duration fields are missing on a material share of records.`; },
    's2.categoryDominance'(v) { return `${v.topCategoryName} dominates the mix at ${v.topCategorySharePct}% of volume.`; },
    's2.zoneDominance'(v)   { return `${v.topZoneName} concentrates ${v.topZoneSharePct}% of total incidents across the network.`; },
    's2.balanced'()         { return `Distribution across categories and zones is within expected bounds.`; },
    s3(v) {
      const cat = v.topCategoryName || 'Leading category';
      const catShare = v.topCategorySharePct == null ? '—' : `${v.topCategorySharePct}%`;
      const med = v.medianResolveMin == null ? '—' : `${v.medianResolveMin}-minute`;
      return `${cat} leads at ${catShare} share with a ${med} median resolve${v.confidenceNote}.`;
    },
    s4(v) {
      if (v.recommendationCount > 0) {
        const plural = v.recommendationCount === 1 ? '' : 's';
        return `${fmtInt(v.recommendationCount)} action${plural} in Recommendations warrant follow-through next cycle.`;
      }
      return `No material anomalies detected; continue routine monitoring.`;
    },
  },
  ko: {
    s1(v) {
      const hd = v.highDifficultyCount > 0
        ? `, 이 중 ${fmtInt(v.highDifficultyCount)}건이 고난이도 처리 건`
        : '';
      return `${v.scope}은(는) ${v.periodTailKo} 총 ${fmtInt(v.totalCount)}건의 인시던트를 기록했습니다${hd}.`;
    },
    's2.empty'()            { return `해당 기간에 집계 가능한 인시던트 레코드가 없습니다.`; },
    's2.criticalHigh'(v)    { return `중대 인시던트가 전체의 ${v.criticalSharePct}%를 차지하여 15% 경계선을 넘어섰습니다.`; },
    's2.frictionSignal'(v)  { return `보고 기준 처리 난이도와 처리 시간 패턴에서 운영 부담 신호가 관찰되나, 본 데이터셋에는 중대 등급 분류가 제공되지 않습니다.`; },
    's2.slowResolve'(v)     { return `중앙 처리 시간은 ${v.medianResolveMin}분으로 120분 검토 기준을 초과했습니다.`; },
    's2.lowCompleteness'(v) { return `보고 완전성은 ${v.completenessPct}%로 85% 기준선을 밑돌며, 조치 내용 또는 소요 시간 항목이 상당수 누락되어 있습니다.`; },
    's2.categoryDominance'(v) { return `${v.topCategoryName} 카테고리가 전체의 ${v.topCategorySharePct}%를 점유하고 있습니다.`; },
    's2.zoneDominance'(v)   { return `${v.topZoneName} 구역이 전체 인시던트의 ${v.topZoneSharePct}%를 차지하고 있습니다.`; },
    's2.balanced'()         { return `카테고리 및 구역 분포가 예상 범위 내에 있습니다.`; },
    s3(v) {
      const cat = v.topCategoryName || '주요 카테고리';
      const catShare = v.topCategorySharePct == null ? '—' : `${v.topCategorySharePct}%`;
      const med = v.medianResolveMin == null ? '—' : `${v.medianResolveMin}분`;
      return `${cat}이(가) ${catShare} 비중으로 가장 많으며, 중앙 처리 시간은 ${med}입니다${v.confidenceNote}.`;
    },
    s4(v) {
      if (v.recommendationCount > 0) {
        return `다음 주기에 ${fmtInt(v.recommendationCount)}건의 권고 조치에 대한 후속 조치가 필요합니다.`;
      }
      return `중대한 이상 징후는 확인되지 않았으며, 정기 모니터링을 지속합니다.`;
    },
  },
};

// ── Helpers ──────────────────────────────────────────────────────

function fmtInt(n) {
  return (n == null || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US');
}

function pctDec(p) {
  return (p == null || !isFinite(p)) ? null : Math.round(p * 1000) / 10;
}

function buildVars(derived, opts) {
  const lang = opts.lang || 'en';
  const confLevel = opts.confidence && opts.confidence.level;
  const confidenceNote = (confLevel === 'low')
    ? (lang === 'ko' ? ' (데이터 품질 보정 필요)' : ' (subject to data-quality caveats)')
    : '';

  const scope = opts.scope
    || (lang === 'ko'
          ? (derived.variant === 'monthlyBranch' ? '해당 지점' : '글로벌 운영')
          : (derived.variant === 'monthlyBranch' ? 'This branch' : 'Global operations'));

  const periodTail   = opts.period ? ` during ${opts.period}` : '';
  const periodTailKo = opts.period ? `${opts.period} 기간` : '';

  return {
    scope,
    periodTail,
    periodTailKo,
    totalCount: derived.totalCount,
    highDifficultyCount: derived.highDifficultyCount || 0,
    criticalSharePct: pctDec(derived.criticalShare),
    medianResolveMin: derived.medianResolveMin == null ? null : Math.round(derived.medianResolveMin),
    completenessPct: pctDec(derived.reportingCompleteness),
    topCategoryName: derived.topCategoryName,
    topCategorySharePct: pctDec(derived.topCategoryShare),
    topZoneName: derived.topZoneName,
    topZoneSharePct: pctDec(derived.topZoneShare),
    confidenceNote,
    recommendationCount: opts.recommendationCount || 0,
  };
}

// ── Main ─────────────────────────────────────────────────────────

function buildNarrative(derived, opts = {}) {
  const lang = (opts.lang === 'ko') ? 'ko' : 'en';
  const tpl = TPL[lang];
  const vars = buildVars(derived, opts);
  const s2Sel = selectS2(derived);

  const s1 = tpl.s1(vars);
  const s2 = tpl[s2Sel.key](vars);
  const s3 = tpl.s3(vars);
  const s4 = tpl.s4(vars);

  return { s1, s2, s3, s4, anomalyKey: s2Sel.key, vars, lang };
}

module.exports = {
  buildNarrative,
  selectS2,
  _thresholds: TH,
};
