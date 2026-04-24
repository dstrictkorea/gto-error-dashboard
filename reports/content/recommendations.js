'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/content/recommendations.js
//
//  SAFETY LAYERS applied:
//    1. Recommendation Confidence Gate — score ≥ 0.95 required before
//       a trigger emits an actionable recommendation. Below the gate,
//       it emits an observation with an explicit "insufficient
//       evidence for action recommendation" note.
//    2. Difficulty Safety Rule — no trigger fires from Difficulty
//       alone. T09 (critical-severity) requires Severity data; it is
//       inert when only Difficulty is available.
//
//  Output:
//    {
//      recommendations: Recommendation[],  // type='recommendation', score≥0.95
//      observations:    Observation[],     // type='observation', factual + note
//      _diagnostics: {...}
//    }
//
//  Each card shape:
//    {
//      id, type, priority, primaryKpi,
//      zone, category, asset,
//      title, observed, action?, note?,
//      confidence: { score, pass, factors, failing }
//    }
// ══════════════════════════════════════════════════════════════════

const { scoreEvidence, MIN_CONFIDENCE } = require('./evidence');

const TH = {
  criticalHighShare: 0.15,
  slowResolveMin: 120,
  slowResolveCategoryMin: 90,
  lowCompleteness: 0.85,
  categoryDominance: 0.35,
  zoneDominance: 0.30,
  hotspotShare: 0.15,
  afterHoursShare: 0.25,
  trendIncrease: 0.20,
};

// Operational Friction Signal (T14) thresholds — observation-only,
// used strictly when Severity data is absent.
// ALL THREE conditions must be met simultaneously (AND gate).
// Single-condition triggers are explicitly disallowed.
const TH_FRICTION = {
  minSampleCount: 20,           // minimum total incidents in period
  highDifficultyShare: 0.25,    // ≥25% of rows at Difficulty ≥4
  medianResolveMin: 90,         // median resolution ≥90 min
  recurrenceDays: 3,            // high-difficulty incidents on ≥3 distinct days
  recurrenceMin: 3,             // minimum high-difficulty rows for recurrence check
};

// Observation density control — when obs exceed this budget the
// render layer receives a Combined Insight Block instead.
const OBS_DENSITY_CAP = 3;

// Executive readability hard-cap: no report ever surfaces more than 3
// recommendations. Rendering contract §3 — "The report must not overwhelm
// decision-makers." Applied after all dedup passes.
const MAX_RECOMMENDATIONS = 3;

// Combined-block bullet cap — rendering contract §1 requires max 3
// visible bullet lines with "...and N more" overflow text.
const COMBINED_BULLET_CAP = 3;

// All caps align with MAX_RECOMMENDATIONS (rendering contract §3).
const CAPS = { compact: 3, standard: 3, expanded: 3 };

// ══════════════════════════════════════════════════════════════════
//  Copy (EN / KO)
//    Each trigger has:
//      title       — for recommendations
//      titleObs    — for observations
//      observed(v) — factual line, safe for both types
//      action(v)   — recommendation action (skipped for observations)
//      noteObs(v)  — the required "insufficient evidence" note
// ══════════════════════════════════════════════════════════════════

const NOTE_OBS_EN = (v) => `Insufficient evidence for action recommendation${v && v.failingText ? ` (${v.failingText})` : ''}; continue monitoring next cycle.`;
const NOTE_OBS_KO = (v) => `권고 조치를 내리기에는 근거가 부족합니다${v && v.failingTextKo ? ` (${v.failingTextKo})` : ''}; 다음 주기에 추이를 확인합니다.`;

const COPY = {
  en: {
    T01: {
      title: 'Restore upstream data ingestion',
      titleObs: 'No incident records in period',
      observed: v => `No qualifying incident records ingested during ${v.period || 'this period'}.`,
      action: () => `Verify source feeds, ingestion timestamps, and filter logic before publishing the next report.`,
      noteObs: () => `No recommendation; zero-case may be a true operational state.`,
    },
    T09: {
      title: 'Investigate critical-severity spike',
      titleObs: 'Reported critical-severity pattern observed',
      observed: v => `Critical incidents account for ${v.criticalSharePct}% of volume (${v.criticalCount}/${v.totalCount})${v.topCritCat ? `, led by ${v.topCritCat}` : ''}. Classification is based on the recorded Severity field.`,
      action: v => `Conduct a focused review of ${v.topCritCat || 'critical-heavy categories'} and share findings with the General Manager.`,
      softAction: v => `Consider a focused review of ${v.topCritCat || 'the elevated critical-severity pattern'} if this trend continues next cycle.`,
      noteObs: NOTE_OBS_EN,
    },
    T04: {
      title: 'Address zone–category hotspot',
      titleObs: 'Zone–category concentration observed',
      observed: v => `${v.hotspotZone} × ${v.hotspotCategory} accounts for ${v.hotspotSharePct}% of volume (${v.hotspotCount} incidents).`,
      action: v => `Conduct a focused review of ${v.hotspotZone} ${v.hotspotCategory} incidents to identify potential drivers and report findings next cycle.`,
      softAction: v => `Consider reviewing operational conditions at ${v.hotspotZone} to understand the ${v.hotspotCategory} concentration pattern.`,
      noteObs: NOTE_OBS_EN,
    },
    T02: {
      title: 'Reduce category concentration',
      titleObs: 'Category-share concentration observed',
      observed: v => `${v.topCategoryName} represents ${v.topCategorySharePct}% of incidents, above the 35% diversification threshold.`,
      action: v => `Prioritize a structural fix or preventive review for ${v.topCategoryName} to rebalance the category mix.`,
      softAction: v => `Consider investigating whether ${v.topCategoryName} dominance reflects a systemic issue or a period-specific variance before taking structural action.`,
      noteObs: NOTE_OBS_EN,
    },
    T03: {
      title: 'Investigate zone concentration',
      titleObs: 'Zone-share concentration observed',
      observed: v => `${v.topZoneName} accounts for ${v.topZoneSharePct}% of network incidents, above the 30% distribution threshold.`,
      action: v => `Review operational conditions and asset age at ${v.topZoneName}; share findings with the General Manager.`,
      softAction: v => `Consider a cross-zone review to determine whether ${v.topZoneName} concentration is worsening or a one-off distribution.`,
      noteObs: NOTE_OBS_EN,
    },
    T05: {
      title: 'Accelerate resolution for slowest category',
      titleObs: 'Extended resolution time in one category',
      observed: v => `${v.slowestCategoryName} shows a ${v.slowestCategoryMedian}-minute median resolve across ${v.slowestCategoryN} cases.`,
      action: v => `Document a standard-response playbook and pre-staged parts for ${v.slowestCategoryName}.`,
      softAction: v => `Consider whether a lightweight checklist or pre-positioned parts for ${v.slowestCategoryName} could reduce handling time variability.`,
      noteObs: NOTE_OBS_EN,
    },
    T06: {
      title: 'Improve reporting discipline',
      titleObs: 'Low reporting completeness observed',
      observed: v => `Reporting completeness is ${v.completenessPct}% — action or duration fields are missing on a material share of records. This measures record completeness, not resolution quality.`,
      action: () => `Reinforce the field-entry standard (ActionTaken, TimeTaken) and add a submission-time validation on the intake form.`,
      softAction: () => `Consider reconfirming field-entry expectations with frontline staff ahead of the next reporting window.`,
      noteObs: NOTE_OBS_EN,
    },
    T11: {
      title: 'Address rising resolution time',
      titleObs: 'Resolution-time trend increase observed',
      observed: v => `Median resolution time increased ${v.trendPct}% versus the prior period (now ${v.medianResolveMin} min).`,
      action: () => `Audit staffing coverage and parts availability; identify the categories driving the shift.`,
      softAction: () => `Consider reviewing whether staffing levels or parts availability shifted relative to the prior period.`,
      noteObs: NOTE_OBS_EN,
    },
    T10: {
      title: 'Strengthen after-hours coverage',
      titleObs: 'After-hours concentration observed',
      observed: v => `${v.afterHoursSharePct}% of incidents occurred between 22:00 and 06:00.`,
      action: () => `Review on-call rotation and escalation paths for overnight shifts.`,
      softAction: () => `Consider whether the after-hours pattern warrants a review of on-call scheduling.`,
      noteObs: NOTE_OBS_EN,
    },
    T12: {
      title: 'Clean up data intake pipeline',
      titleObs: 'Incomplete records in intake',
      observed: v => `${v.excludedPct}% of submitted records (${v.excludedCount}) were excluded for missing dates or out-of-period entries.`,
      action: () => `Harden intake validation (required Date, period-gated submission) before the next reporting window.`,
      noteObs: NOTE_OBS_EN,
    },
    T13: {
      title: 'Continue targeted monitoring',
      titleObs: 'Narrative anomaly without evidence-backed trigger',
      observed: () => `An anomaly was flagged in the narrative but no specific trigger reached the evidence threshold.`,
      action: v => `Monitor ${v.topCategoryName || 'leading categories'} through the next reporting cycle and revisit if the pattern persists.`,
      noteObs: () => `Observation only; action recommendation requires recurrence, duration, or concentration support.`,
    },
    T14: {
      // Always an observation. Never a recommendation. Never implies criticality.
      title: 'Operational friction signal',
      titleObs: 'Operational friction signal',
      observed: v => {
        const parts = [];
        if (v.frictionHighDiffActive)  parts.push(`reported handling difficulty ≥4 on ${v.highDifficultySharePct}% of incidents`);
        if (v.frictionResolveActive)   parts.push(`median resolve ${v.medianResolveMin} min`);
        if (v.frictionRecurrenceActive) parts.push(`spread across ${v.highDifficultyDistinctDays} days`);
        const body = parts.length ? parts.join('; ') : 'reported difficulty and resolution patterns';
        return `${capitalize(body)}. Severity classification is not available in this dataset — this is an observational signal, not a conclusion of criticality.`;
      },
      action: null,   // T14 never has an action path
      noteObs: () => `Reported handling difficulty and resolution patterns suggest operational strain, but no action is recommended unless supported by recurrence, duration, or concentration patterns.`,
    },
  },
  ko: {
    T01: {
      title: '데이터 수집 경로 복구',
      titleObs: '해당 기간에 인시던트 레코드 없음',
      observed: v => `${v.period || '이번 기간'}에 집계 가능한 인시던트 레코드가 없습니다.`,
      action: () => `다음 보고서 발행 전에 원본 피드, 수집 타임스탬프, 필터 로직을 점검하십시오.`,
      noteObs: () => `권고 없음; 실제 무발생 상태일 수 있습니다.`,
    },
    T09: {
      title: '중대 인시던트 급증 원인 조사',
      titleObs: '중대 등급 보고 패턴 관찰',
      observed: v => `중대 인시던트가 전체의 ${v.criticalSharePct}% (${v.criticalCount}/${v.totalCount})${v.topCritCat ? ` — 주요 카테고리 ${v.topCritCat}` : ''}입니다. 등급은 기록된 Severity 항목 기준입니다.`,
      action: v => `${v.topCritCat || '중대 등급 집중 카테고리'}를 집중 검토하고 결과를 관장에게 공유하십시오.`,
      softAction: v => `${v.topCritCat || '중대 인시던트 패턴'}이 다음 주기에도 지속된다면 집중 검토를 고려하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T04: {
      title: '구역·카테고리 집중 대응',
      titleObs: '구역·카테고리 집중 패턴 관찰',
      observed: v => `${v.hotspotZone} × ${v.hotspotCategory}가 전체의 ${v.hotspotSharePct}% (${v.hotspotCount}건)입니다.`,
      action: v => `${v.hotspotZone}의 ${v.hotspotCategory} 인시던트를 집중 검토하여 잠재적 원인을 파악하고 다음 주기에 결과를 보고하십시오.`,
      softAction: v => `${v.hotspotZone}의 운영 환경을 검토하여 ${v.hotspotCategory} 집중 패턴을 파악하는 것을 고려하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T02: {
      title: '카테고리 편중 완화',
      titleObs: '카테고리 비중 집중 관찰',
      observed: v => `${v.topCategoryName} 카테고리가 전체의 ${v.topCategorySharePct}%로 35% 분산 기준을 초과합니다.`,
      action: v => `${v.topCategoryName}에 대한 구조적 개선 또는 예방 점검을 우선 진행하여 카테고리 분산을 회복하십시오.`,
      softAction: v => `${v.topCategoryName} 편중이 구조적 문제인지 기간 변동인지 확인한 후 조치 여부를 검토하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T03: {
      title: '구역 편중 조사',
      titleObs: '구역 비중 집중 관찰',
      observed: v => `${v.topZoneName} 구역이 전체의 ${v.topZoneSharePct}%로 30% 분산 기준을 초과합니다.`,
      action: v => `${v.topZoneName}의 운영 환경과 자산 노후도를 점검하고 결과를 관장에게 공유하십시오.`,
      softAction: v => `${v.topZoneName} 편중이 지속되는지 여부를 파악하기 위한 구역 간 검토를 고려하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T05: {
      title: '지연 카테고리 처리 시간 단축',
      titleObs: '특정 카테고리 처리 시간 장기화 관찰',
      observed: v => `${v.slowestCategoryName}의 중앙 처리 시간이 ${v.slowestCategoryMedian}분 (${v.slowestCategoryN}건)입니다.`,
      action: v => `${v.slowestCategoryName}에 대한 표준 대응 절차와 사전 부품 배치를 정립하십시오.`,
      softAction: v => `${v.slowestCategoryName}에 대한 간단한 체크리스트나 사전 부품 배치로 처리 시간 변동성을 줄일 수 있는지 검토하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T06: {
      title: '보고 규율 개선',
      titleObs: '보고 완전성 저하 관찰',
      observed: v => `보고 완전성이 ${v.completenessPct}%로 조치 내용 또는 소요 시간 항목이 상당수 누락되어 있습니다. 이는 처리 품질이 아닌 기록 완결성 지표입니다.`,
      action: () => `ActionTaken, TimeTaken 항목 입력 기준을 재공지하고, 접수 폼에 제출 시점 유효성 검증을 추가하십시오.`,
      softAction: () => `다음 보고 주기 전에 현장 직원에게 항목 입력 기준을 다시 확인시켜 주는 것을 고려하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T11: {
      title: '처리 시간 증가 대응',
      titleObs: '처리 시간 증가 추세 관찰',
      observed: v => `중앙 처리 시간이 전년 대비 ${v.trendPct}% 증가했습니다 (현재 ${v.medianResolveMin}분).`,
      action: () => `인력 배치와 부품 가용성을 점검하고, 증가를 유발한 카테고리를 식별하십시오.`,
      softAction: () => `전년 대비 인력 배치나 부품 가용성이 변화했는지 검토를 고려하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T10: {
      title: '야간 시간대 대응 강화',
      titleObs: '야간 시간대 집중 관찰',
      observed: v => `22:00–06:00 시간대 인시던트가 전체의 ${v.afterHoursSharePct}%입니다.`,
      action: () => `야간 당직 로테이션과 에스컬레이션 절차를 재검토하십시오.`,
      softAction: () => `야간 시간대 패턴이 당직 일정 재검토를 정당화하는지 고려하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T12: {
      title: '데이터 수집 파이프라인 정비',
      titleObs: '수집 레코드 누락 관찰',
      observed: v => `제출된 레코드 중 ${v.excludedPct}% (${v.excludedCount}건)가 날짜 누락 또는 기간 이탈로 제외되었습니다.`,
      action: () => `다음 보고 주기 전에 필수 Date 항목과 기간 제한 제출을 포함하여 입력 유효성 검증을 강화하십시오.`,
      noteObs: NOTE_OBS_KO,
    },
    T13: {
      title: '타깃 모니터링 지속',
      titleObs: '서술부 이상 징후, 트리거 근거 부족',
      observed: () => `서술부에서 이상 징후가 식별되었으나 개별 트리거는 증거 임계값에 도달하지 않았습니다.`,
      action: v => `다음 주기에 ${v.topCategoryName || '주요 카테고리'}를 중점 모니터링하고, 집중이 지속되면 재검토하십시오.`,
      noteObs: () => `관찰만 유지; 권고 조치는 재발·장기화·집중 패턴이 뒷받침되어야 합니다.`,
    },
    T14: {
      title: '운영 부담 관찰 신호',
      titleObs: '운영 부담 관찰 신호',
      observed: v => {
        const parts = [];
        if (v.frictionHighDiffActive)   parts.push(`보고 난이도 4 이상 인시던트가 전체의 ${v.highDifficultySharePct}%`);
        if (v.frictionResolveActive)    parts.push(`중앙 처리 시간 ${v.medianResolveMin}분`);
        if (v.frictionRecurrenceActive) parts.push(`${v.highDifficultyDistinctDays}일에 걸친 재발`);
        const body = parts.length ? parts.join(', ') : '보고 기준 난이도 및 처리 시간 패턴';
        return `${body}이(가) 관찰됩니다. 본 데이터셋에는 중대 등급 분류가 제공되지 않으므로, 본 신호는 관찰 사항이며 중대성에 대한 결론이 아닙니다.`;
      },
      action: null,
      noteObs: () => `보고 기준 처리 난이도와 처리 시간 패턴에서 운영 부담 신호가 관찰되나, 재발·장기화·집중 패턴이 뒷받침되지 않는 한 권고 조치는 내리지 않습니다.`,
    },
  },
};

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Variable preparation ─────────────────────────────────────────

function pctDec(p) {
  return (p == null || !isFinite(p)) ? null : Math.round(p * 1000) / 10;
}

function buildVars(d, opts, extras) {
  return Object.assign({
    period: opts.period || '',
    totalCount: d.totalCount,
    criticalCount: d.criticalCount,
    criticalSharePct: pctDec(d.criticalShare),
    highDifficultyCount: d.highDifficultyCount,
    highDifficultySharePct: pctDec(d.highDifficultyShare),
    completenessPct: pctDec(d.reportingCompleteness),
    medianResolveMin: d.medianResolveMin == null ? null : Math.round(d.medianResolveMin),
    topCategoryName: d.topCategoryName,
    topCategorySharePct: pctDec(d.topCategoryShare),
    topZoneName: d.topZoneName,
    topZoneSharePct: pctDec(d.topZoneShare),
    topCritCat: null, // set per-trigger when needed
    hotspotZone: d.topHotspot && d.topHotspot.zone,
    hotspotCategory: d.topHotspot && d.topHotspot.category,
    hotspotCount: d.topHotspot && d.topHotspot.count,
    hotspotSharePct: pctDec(d.topHotspot && d.topHotspot.share),
    slowestCategoryName: d.slowestCategory && d.slowestCategory.name,
    slowestCategoryMedian: d.slowestCategory && d.slowestCategory.median == null ? null : Math.round(d.slowestCategory.median),
    slowestCategoryN: d.slowestCategory && d.slowestCategory.n,
    afterHoursSharePct: pctDec(d.afterHoursShare),
    trendPct: opts.trendPct,
    excludedPct: opts.excludedPct,
    excludedCount: opts.excludedCount,
  }, extras || {});
}

// Human-readable failing-factor summary used in observation notes.
const FAIL_TEXT_EN = {
  sampleSize: 'sample below minimum threshold',
  dominance: 'share margin below 20%',
  temporal: 'concentrated across too few days',
  noise: 'single-day concentration',
};
const FAIL_TEXT_KO = {
  sampleSize: '표본 크기 부족',
  dominance: '편중 마진 20% 미만',
  temporal: '발생일 분산 부족',
  noise: '단일일 집중',
};

function describeFailing(evidence, lang) {
  if (!evidence || !evidence.failing || !evidence.failing.length) return { failingText: '', failingTextKo: '' };
  if (lang === 'ko') {
    return { failingTextKo: evidence.failing.map(f => FAIL_TEXT_KO[f] || f).join(', ') };
  }
  return { failingText: evidence.failing.map(f => FAIL_TEXT_EN[f] || f).join(', ') };
}

// ══════════════════════════════════════════════════════════════════
//  Trigger catalog
//    Each entry declares:
//      id, priority, primaryKpi
//      fires(d, opts)        → boolean         — gating condition
//      scope(d, opts)        → evidenceSpec|'always'  — what to score
//      tupleKey(d)           → 'zone|cat|asset'
//      extras(d, opts)       → {}              — trigger-specific vars
//      keys(d)               → { zone, category, asset }
// ══════════════════════════════════════════════════════════════════

const CATALOG = [
  {
    id: 'T01', priority: 10, primaryKpi: 'K1',
    fires: (d) => d.totalCount === 0,
    scope: () => 'always',                                   // factual zero-case
    keys:  () => ({ zone: null, category: null, asset: null }),
    extras: () => ({}),
  },
  {
    id: 'T09', priority: 20, primaryKpi: 'K2',
    // CRITICAL: Severity-based only. Difficulty cannot fire this trigger.
    fires: (d) => d.hasSeverityData
      && d.totalCount > 0
      && d.criticalShare != null
      && d.criticalShare >= TH.criticalHighShare,
    scope: (d) => ({
      n: d.criticalCount,
      share: d.criticalShare,
      threshold: TH.criticalHighShare,
      distinctDays: d.evidence.severityCritical.distinctDays,
      maxDayShare: d.evidence.severityCritical.maxDayShare,
      config: { minSample: 10 },
    }),
    keys: (d) => ({ zone: null, category: 'critical', asset: null }),
    extras: (d) => ({ topCritCat: null }), // no per-category severity aggregation yet
  },
  {
    id: 'T04', priority: 30, primaryKpi: 'K6',
    fires: (d) => d.totalCount > 0
      && d.topHotspot && d.topHotspot.share != null
      && d.topHotspot.share >= TH.hotspotShare,
    scope: (d) => ({
      n: d.topHotspot.count,
      share: d.topHotspot.share,
      threshold: TH.hotspotShare,
      distinctDays: d.evidence.topHotspot.distinctDays,
      maxDayShare: d.evidence.topHotspot.maxDayShare,
      config: { minSample: 5 },
    }),
    keys: (d) => ({ zone: d.topHotspot.zone, category: d.topHotspot.category, asset: null }),
    extras: () => ({}),
  },
  {
    id: 'T02', priority: 40, primaryKpi: 'K4',
    fires: (d) => d.totalCount > 0
      && d.topCategoryShare != null
      && d.topCategoryShare >= TH.categoryDominance,
    scope: (d) => ({
      n: Math.round((d.topCategoryShare || 0) * d.totalCount),
      share: d.topCategoryShare,
      threshold: TH.categoryDominance,
      distinctDays: d.evidence.topCategory.distinctDays,
      maxDayShare: d.evidence.topCategory.maxDayShare,
      config: { minSample: 10 },
    }),
    keys: (d) => ({ zone: null, category: d.topCategoryName, asset: null }),
    extras: () => ({}),
  },
  {
    id: 'T03', priority: 50, primaryKpi: 'K6',
    fires: (d) => (d.variant === 'monthlyGlobal' || d.variant === 'annual')
      && d.totalCount > 0
      && d.topZoneShare != null
      && d.topZoneShare >= TH.zoneDominance,
    scope: (d) => ({
      n: Math.round((d.topZoneShare || 0) * d.totalCount),
      share: d.topZoneShare,
      threshold: TH.zoneDominance,
      distinctDays: d.evidence.topZone.distinctDays,
      maxDayShare: d.evidence.topZone.maxDayShare,
      config: { minSample: 10 },
    }),
    keys: (d) => ({ zone: d.topZoneName, category: null, asset: null }),
    extras: () => ({}),
  },
  {
    id: 'T05', priority: 60, primaryKpi: 'K3',
    fires: (d) => d.slowestCategory && d.slowestCategory.name != null
      && d.slowestCategory.median != null
      && d.slowestCategory.median > TH.slowResolveCategoryMin,
    scope: (d) => ({
      n: d.slowestCategory.n,
      // No dominance concept — gate via sample + temporal + noise only.
      distinctDays: d.evidence.slowestCategory.distinctDays,
      maxDayShare: d.evidence.slowestCategory.maxDayShare,
      config: { minSample: 10 },
    }),
    keys: (d) => ({ zone: null, category: d.slowestCategory.name, asset: null }),
    extras: () => ({}),
  },
  {
    id: 'T06', priority: 70, primaryKpi: 'K5',
    fires: (d) => d.totalCount > 0
      && d.reportingCompleteness != null
      && d.reportingCompleteness < TH.lowCompleteness,
    scope: (d) => ({
      n: d.totalCount,
      distinctDays: d.evidence.completeness.distinctDays,
      // No dominance (threshold crossing is below-baseline) and no day-noise relevance.
      config: { minSample: 10 },
    }),
    keys: () => ({ zone: null, category: null, asset: null }),
    extras: () => ({}),
  },
  {
    id: 'T11', priority: 80, primaryKpi: 'K7',
    fires: (d, opts) => {
      if (d.variant !== 'annual') return false;
      const prior = opts && opts.priorMedianResolveMin;
      if (!isFinite(prior) || prior <= 0 || d.medianResolveMin == null) return false;
      return (d.medianResolveMin - prior) / prior >= TH.trendIncrease;
    },
    scope: (d, opts) => ({
      n: d.totalCount,
      share: (d.medianResolveMin - opts.priorMedianResolveMin) / opts.priorMedianResolveMin,
      threshold: TH.trendIncrease,
      distinctDays: d.evidence.all.distinctDays,
      config: { minSample: 50 }, // annual trend wants real volume
    }),
    keys: () => ({ zone: null, category: null, asset: null }),
    extras: (d, opts) => {
      const prior = opts.priorMedianResolveMin;
      const trendPct = prior > 0 ? Math.round((d.medianResolveMin - prior) / prior * 100) : null;
      return { trendPct };
    },
  },
  {
    id: 'T10', priority: 110, primaryKpi: 'K3',
    fires: (d) => d.totalCount > 0
      && d.afterHoursShare != null
      && d.afterHoursShare >= TH.afterHoursShare,
    scope: (d) => ({
      n: d.afterHoursCount,
      share: d.afterHoursShare,
      threshold: TH.afterHoursShare,
      distinctDays: d.evidence.afterHours.distinctDays,
      maxDayShare: d.evidence.afterHours.maxDayShare,
      config: { minSample: 10 },
    }),
    keys: () => ({ zone: null, category: null, asset: null }),
    extras: () => ({}),
  },
  {
    id: 'T12', priority: 120, primaryKpi: 'K1',
    fires: (d, opts) => opts && opts.confidence && opts.confidence.level === 'low',
    scope: () => 'always',                                   // finding IS the data quality flag
    keys: () => ({ zone: null, category: null, asset: null }),
    extras: (d, opts) => ({
      excludedPct: opts.confidence && opts.confidence.excludedPct,
      excludedCount: opts.confidence && opts.confidence.excludedCount,
    }),
  },
  {
    id: 'T14', priority: 200, primaryKpi: 'K3',
    // Fires ONLY when Severity is absent AND at least one friction
    // indicator is tripped. Always emitted as observation; never a
    // recommendation; never implies criticality.
    forceObservation: true,
    fires: (d) => {
      if (d.hasSeverityData) return false;
      if (!d.totalCount || d.totalCount < TH_FRICTION.minSampleCount) return false;
      // AND gate: all three required. Single-condition triggers are disallowed.
      const hdActive   = (d.highDifficultyShare != null) && (d.highDifficultyShare >= TH_FRICTION.highDifficultyShare);
      const resActive  = (d.medianResolveMin != null)    && (d.medianResolveMin     >= TH_FRICTION.medianResolveMin);
      const recActive  = !!(d.evidence && d.evidence.highDifficulty
                            && d.evidence.highDifficulty.distinctDays >= TH_FRICTION.recurrenceDays
                            && d.evidence.highDifficulty.n            >= TH_FRICTION.recurrenceMin);
      return hdActive && resActive && recActive;
    },
    scope: () => 'always',    // no evidence gate applied — signal is observational by design
    keys: () => ({ zone: null, category: null, asset: null }),
    extras: (d) => ({
      frictionHighDiffActive:   d.highDifficultyShare != null && d.highDifficultyShare >= TH_FRICTION.highDifficultyShare,
      frictionResolveActive:    d.medianResolveMin != null && d.medianResolveMin >= TH_FRICTION.medianResolveMin,
      frictionRecurrenceActive: !!(d.evidence && d.evidence.highDifficulty
                                   && d.evidence.highDifficulty.distinctDays >= TH_FRICTION.recurrenceDays
                                   && d.evidence.highDifficulty.n            >= TH_FRICTION.recurrenceMin),
      highDifficultyDistinctDays: d.evidence && d.evidence.highDifficulty ? d.evidence.highDifficulty.distinctDays : 0,
    }),
  },
  {
    id: 'T13', priority: 999, primaryKpi: 'K1',
    forceObservation: true,   // fallback is always observational
    fires: () => false,       // injected only by stage 3d fallback
    scope: () => 'always',
    keys: () => ({ zone: null, category: null, asset: null }),
    extras: () => ({}),
  },
];

// ── Card builder ─────────────────────────────────────────────────

function buildCard(trigger, evidence, d, lang, opts) {
  const extras = trigger.extras(d, opts) || {};
  const failing = describeFailing(evidence, lang);
  const vars = buildVars(d, opts, Object.assign({}, extras, failing));
  const L = COPY[lang] && COPY[lang][trigger.id] ? lang : 'en';
  const c = COPY[L][trigger.id];
  const keys = trigger.keys(d, opts);

  // Triggers declared with forceObservation never emit as
  // recommendations — T13 (fallback) and T14 (friction signal).
  const forceObservation = !!trigger.forceObservation;
  const asRecommendation = evidence.pass && !forceObservation;

  const isSoft = asRecommendation && evidence.passPath === 'dualPath';

  const card = {
    id: trigger.id,
    type: asRecommendation ? 'recommendation' : 'observation',
    // strength distinguishes executive-grade (strict) from hedged (soft).
    // Absent on observations.
    ...(asRecommendation && { strength: isSoft ? 'soft' : 'strict' }),
    priority: trigger.priority,
    primaryKpi: trigger.primaryKpi,
    zone: keys.zone || null,
    category: keys.category || null,
    asset: keys.asset || null,
    title: asRecommendation ? c.title : c.titleObs,
    observed: c.observed(vars),
    confidence: {
      score: evidence.score,
      pass: evidence.pass,
      passPath: evidence.passPath,    // 'strict' | 'dualPath' | null
      factors: evidence.factors,
      strongCount: evidence.strongCount,
      failing: evidence.failing,
    },
  };

  if (asRecommendation) {
    // Soft recommendations use hedged language ("Consider reviewing…")
    // rather than directives. Falls back to action if softAction not defined.
    const actionFn = isSoft && c.softAction ? c.softAction : c.action;
    card.action = actionFn ? actionFn(vars) : null;
  } else {
    card.note = c.noteObs(vars);
  }

  return card;
}

// ── Dedup stages (applied to recommendations only) ───────────────

const PAIR_SUPPRESSIONS = [
  (set) => {
    const t4 = set.find(r => r.id === 'T04');
    const t2 = set.find(r => r.id === 'T02');
    if (t4 && t2 && t4.category && t2.category && t4.category === t2.category) return ['T02'];
    return [];
  },
  (set) => {
    const t4 = set.find(r => r.id === 'T04');
    const t3 = set.find(r => r.id === 'T03');
    if (t4 && t3 && t4.zone && t3.zone && t4.zone === t3.zone) return ['T03'];
    return [];
  },
  (set) => {
    if (set.some(r => r.id === 'T11') && set.some(r => r.id === 'T05')) return ['T05'];
    return [];
  },
];

function dedup3a(set) {
  let out = set.slice();
  for (const rule of PAIR_SUPPRESSIONS) {
    const toRemove = rule(out);
    if (toRemove.length) out = out.filter(r => !toRemove.includes(r.id));
  }
  return out;
}

function dedup3b(set) {
  const byKey = new Map();
  for (const r of set) {
    const key = `${r.zone || '*'}|${r.category || '*'}|${r.asset || '*'}`;
    const prev = byKey.get(key);
    if (!prev || r.priority < prev.priority) byKey.set(key, r);
  }
  return [...byKey.values()];
}

function dedup3c(set) { return set; /* T08 asset roll-up reserved */ }

// ── Observation density control ──────────────────────────────────
// When observations exceed OBS_DENSITY_CAP, they are grouped by
// shared dimension and merged into Combined Insight Blocks. This
// prevents the observation section from overwhelming the report.

const COMBINED_TITLES = {
  en: {
    dataQuality:  'Data quality observations',
    signal:       'Operational signals',
    hotspot:      'Zone–category concentration patterns',
    zone:         'Zone distribution patterns',
    category:     'Category patterns',
    operational:  'Operational performance patterns',
  },
  ko: {
    dataQuality:  '데이터 품질 관찰',
    signal:       '운영 신호',
    hotspot:      '구역·카테고리 집중 패턴',
    zone:         '구역 분포 패턴',
    category:     '카테고리 패턴',
    operational:  '운영 성과 패턴',
  },
};

const COMBINED_NOTE = {
  en: 'These patterns are observational. No specific action is recommended; monitor all dimensions next cycle.',
  ko: '이 패턴들은 관찰 사항입니다. 구체적인 권고 조치 없음; 다음 주기에 전반적 추이를 모니터링합니다.',
};

function classifyDimension(o) {
  if (['T06', 'T12'].includes(o.id)) return 'dataQuality';
  if (['T14', 'T13'].includes(o.id)) return 'signal';
  if (o.zone && o.category) return 'hotspot';
  if (o.zone) return 'zone';
  if (o.category) return 'category';
  return 'operational';
}

function firstClause(s) {
  // First sentence (up to first ". ") capped at 120 chars for compactness.
  const i = s && s.indexOf('. ');
  if (i >= 0 && i < 120) return s.slice(0, i + 1);
  if (!s || s.length <= 120) return s || '';
  return s.slice(0, 117) + '…';
}

function buildCombinedCard(group, dim, lang) {
  const L = COMBINED_TITLES[lang] ? lang : 'en';
  const minPriority = Math.min(...group.map(o => o.priority || 999));
  const maxScore    = Math.max(...group.map(o => (o.confidence && o.confidence.score) || 0));
  const allBullets  = group.map(o => `· ${firstClause(o.observed)}`);
  // Rendering contract §1: max 3 bullet lines. Append overflow notice.
  const visibleBullets = allBullets.slice(0, COMBINED_BULLET_CAP);
  const overflow = allBullets.length - visibleBullets.length;
  if (overflow > 0) {
    const moreLine = L === 'ko'
      ? `· …그 외 ${overflow}건의 패턴이 추가로 관찰됨`
      : `· …and ${overflow} more pattern${overflow === 1 ? '' : 's'} observed`;
    visibleBullets.push(moreLine);
  }

  return {
    id: `COMBINED_${dim.toUpperCase()}`,
    type: 'combinedObservation',
    priority: minPriority,
    zone: null, category: null, asset: null,
    title: COMBINED_TITLES[L][dim] || 'Patterns observed',
    observed: visibleBullets.join('\n'),
    note: COMBINED_NOTE[L],
    count: group.length,
    truncatedCount: overflow,
    sources: group.map(o => o.id),
    confidence: { score: maxScore, pass: false, passPath: null, factors: {}, failing: [] },
  };
}

function combineObservations(obs, lang) {
  if (!obs || obs.length <= OBS_DENSITY_CAP) return obs || [];

  // Group by dimension
  const groups = {};
  for (const o of obs) {
    const dim = classifyDimension(o);
    if (!groups[dim]) groups[dim] = [];
    groups[dim].push(o);
  }

  // Singletons pass through; multi-card groups are merged
  const result = [];
  for (const [dim, group] of Object.entries(groups)) {
    result.push(group.length === 1 ? group[0] : buildCombinedCard(group, dim, lang));
  }

  // Sort by priority and cap at density limit
  return result.sort((a, b) => (a.priority || 999) - (b.priority || 999)).slice(0, OBS_DENSITY_CAP);
}

function dedup3d(set, cap) {
  return set.slice().sort((a, b) => a.priority - b.priority).slice(0, cap);
}

// ── Main ─────────────────────────────────────────────────────────

function buildRecommendations(derived, opts = {}) {
  const lang = (opts.lang === 'ko') ? 'ko' : 'en';
  const variant = derived.variant || 'monthlyBranch';
  const capName = opts.cap
    || (variant === 'monthlyBranch' ? 'compact'
        : variant === 'monthlyGlobal' ? 'standard' : 'expanded');
  const cap = CAPS[capName] || CAPS.standard;

  const fired = [];
  for (const t of CATALOG) {
    if (!t.fires(derived, opts)) continue;
    const spec = t.scope(derived, opts);
    const evidence = (spec === 'always')
      ? { pass: true, score: 1, passPath: 'strict', factors: { sampleSize: 1, dominance: 1, temporal: 1, noise: 1 }, strongCount: 4, failing: [] }
      : scoreEvidence(spec);
    const card = buildCard(t, evidence, derived, lang, opts);
    fired.push(card);
  }

  // Split into recommendations vs observations — each class is capped
  // and dedup'd independently. Recommendations go through the pair /
  // tuple / fallback ladder; observations skip fallback injection but
  // still respect tuple dedup so the page doesn't repeat the same fact.
  const recsRaw = fired.filter(c => c.type === 'recommendation');
  const obsRaw  = fired.filter(c => c.type === 'observation');

  const recAfter3a = dedup3a(recsRaw);
  const recAfter3b = dedup3b(recAfter3a);
  const recAfter3c = dedup3c(recAfter3b);
  const recAfterDedup = dedup3d(recAfter3c, cap);
  // Executive hard-cap: ≤ MAX_RECOMMENDATIONS regardless of variant.
  // dedup3d already sorted by priority; highest priority items survive.
  const recommendations = recAfterDedup.slice(0, MAX_RECOMMENDATIONS);

  const obsDeduped = dedup3b(obsRaw);
  const obsSorted  = dedup3d(obsDeduped, cap * 2);
  // Merge excess observations into Combined Insight Blocks so the
  // output stays within the density budget.
  const observations = combineObservations(obsSorted, lang);

  // Fallback injection: when narrative flagged an anomaly but nothing
  // (not even an observation) exists, emit T13 as observation.
  if (recommendations.length === 0 && observations.length === 0
      && opts.anomalyKey
      && opts.anomalyKey !== 's2.balanced'
      && opts.anomalyKey !== 's2.empty') {
    const t13 = CATALOG.find(t => t.id === 'T13');
    const evidence = { pass: false, score: 0, factors: { sampleSize: 0, dominance: 0, temporal: 0, noise: 0 }, failing: ['sampleSize', 'dominance', 'temporal', 'noise'] };
    observations.push(buildCard(t13, evidence, derived, lang, opts));
  }

  return {
    recommendations,
    observations,
    _diagnostics: {
      firedCount: fired.length,
      recRaw: recsRaw.length,
      obsRaw: obsRaw.length,
      recFinal: recommendations.length,
      obsFinal: observations.length,
      cap,
      capName,
      minConfidence: MIN_CONFIDENCE,
    },
  };
}

module.exports = {
  buildRecommendations,
  CATALOG,
  _thresholds: TH,
  _caps: CAPS,
};
