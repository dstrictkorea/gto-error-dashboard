'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/content/validate.js
//
//  Post-build consistency validator. Pure.
//  Runs after KPI + Recommendations + Narrative assembly.
//
//  Enforcements:
//    1. KPI ordering matches the locked K1..K7 subset.
//    2. Confidence signal ↔ legend ↔ per-KPI flag are consistent.
//    3. Narrative numeric vars match KPI derived numbers exactly.
//    4. Recommendations carry no (zone|category|asset) duplicates.
//    5. When narrative flags an anomaly, at least one card
//       (recommendation OR observation) must exist.
//    6. Recommendation count does not exceed the variant cap.
//    7. Unified critical classifier present on derived.
//    8. K5 is tagged reporting_completeness (not SLA).
//    9. K2 is either severity_critical (Severity present) OR
//       reported_difficulty (labelled "Reported").
//   10. SAFETY: every recommendation has confidence.pass === true.
//       No recommendation may be emitted below the 0.95 gate.
//   11. SAFETY: T14 (Operational Friction Signal) never appears as
//       a recommendation.
//   12. SAFETY: T09 never fires without hasSeverityData.
//   13. Every observation carries a note; every recommendation an action.
// ══════════════════════════════════════════════════════════════════

const LOCKED_KPI_ORDER = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'];
const VARIANT_CAPS = { monthlyBranch: 3, monthlyGlobal: 5, annual: 7 };
const MIN_CONFIDENCE = 0.95;

function validateReport(ctx) {
  const errors = [];
  const warnings = [];

  if (!ctx || typeof ctx !== 'object') {
    return { ok: false, errors: ['ctx missing'], warnings: [] };
  }

  // 1. KPI ordering ----------------------------------------------
  const ids = (ctx.kpis || []).map(k => k.id);
  let cursor = 0;
  for (const id of ids) {
    const idx = LOCKED_KPI_ORDER.indexOf(id);
    if (idx < 0) { errors.push(`kpi.order: unknown KPI id ${id}`); continue; }
    if (idx < cursor) errors.push(`kpi.order: ${id} appears out of locked sequence`);
    else cursor = idx;
  }

  // 2. Confidence ↔ legend ↔ per-KPI flag ------------------------
  const conf = ctx.confidence || {};
  const anyLowKpi = (ctx.kpis || []).some(k => k.confidence === 'low');
  const hasLegend = !!ctx.confidenceLegend;
  if (conf.level === 'low') {
    if (!anyLowKpi) errors.push('confidence.low: no KPI flagged with confidence=low');
    if (!hasLegend) errors.push('confidence.low: legend missing');
  } else {
    if (anyLowKpi) errors.push('confidence.full: KPI flagged low without global low-confidence');
    if (hasLegend) warnings.push('confidence.full: legend present without low-confidence signal');
  }

  // 3. KPI ↔ narrative numeric agreement -------------------------
  const d = ctx.derived || {};
  const v = (ctx.narrative && ctx.narrative.vars) || {};
  if ('totalCount' in v && v.totalCount !== d.totalCount) {
    errors.push(`narrative.totalCount (${v.totalCount}) != derived.totalCount (${d.totalCount})`);
  }
  if ('criticalCount' in v && v.criticalCount !== d.criticalCount) {
    errors.push(`narrative.criticalCount (${v.criticalCount}) != derived.criticalCount (${d.criticalCount})`);
  }

  // 4. Recommendation semantic-tuple dedup -----------------------
  const seen = new Set();
  for (const r of (ctx.recommendations || [])) {
    const k = `${r.zone || '*'}|${r.category || '*'}|${r.asset || '*'}`;
    if (seen.has(k)) errors.push(`recommendations.dedup violation: ${k}`);
    seen.add(k);
  }

  // 5. Anomaly ↔ non-empty cards (rec OR observation) -----------
  const anomalyKey = ctx.anomalyKey;
  const recCount = (ctx.recommendations || []).length;
  const obsCount = (ctx.observations || []).length;
  const exemptAnomalies = new Set(['s2.balanced', 's2.empty']);
  if (anomalyKey && !exemptAnomalies.has(anomalyKey) && (recCount + obsCount) === 0) {
    errors.push(`anomaly ${anomalyKey}: no recommendation or observation surfaced (fallback failed)`);
  }

  // 6. Recommendation cap ----------------------------------------
  const variant = ctx.variant || (ctx.derived && ctx.derived.variant) || 'monthlyBranch';
  const cap = VARIANT_CAPS[variant] || 5;
  if (recCount > cap) errors.push(`recommendations.count ${recCount} exceeds cap ${cap} for ${variant}`);

  // 7. Unified critical classifier present -----------------------
  if (d.classifiers && typeof d.classifiers.isCritical !== 'function') {
    errors.push('derived.classifiers.isCritical missing — unified critical definition broken');
  }

  // 8. K5 semantic tag -------------------------------------------
  const k5 = (ctx.kpis || []).find(k => k.id === 'K5');
  if (k5 && k5.semantic !== 'reporting_completeness') {
    errors.push('K5 semantic tag is not reporting_completeness');
  }

  // 9. K2 semantic tag -------------------------------------------
  const k2 = (ctx.kpis || []).find(k => k.id === 'K2');
  if (k2) {
    const allowed = ['severity_critical', 'reported_difficulty'];
    if (!allowed.includes(k2.semantic)) {
      errors.push(`K2 semantic tag ${k2.semantic} not in ${allowed.join('|')}`);
    }
    if (k2.semantic === 'reported_difficulty' && !k2.hint) {
      errors.push('K2 reported_difficulty must carry a "Reported" hint');
    }
    if (k2.semantic === 'severity_critical' && !d.hasSeverityData) {
      errors.push('K2 semantic=severity_critical but derived.hasSeverityData is false');
    }
    if (k2.semantic === 'reported_difficulty' && d.hasSeverityData) {
      errors.push('K2 semantic=reported_difficulty but derived.hasSeverityData is true');
    }
  }

  // 10. SAFETY: every recommendation must have confidence.pass ---
  for (const r of (ctx.recommendations || [])) {
    if (!r.confidence || r.confidence.pass !== true) {
      errors.push(`SAFETY VIOLATION: recommendation ${r.id} has confidence.pass !== true`);
    }
    if (r.confidence && isFinite(r.confidence.score) && r.confidence.score < MIN_CONFIDENCE
        && !r.confidence.passPath) {
      errors.push(`SAFETY VIOLATION: recommendation ${r.id} passed no gate (score ${r.confidence.score}, passPath null)`);
    }
    if (!r.action) {
      errors.push(`recommendation ${r.id} missing action field`);
    }
    if (!['strict', 'soft'].includes(r.strength)) {
      errors.push(`recommendation ${r.id} missing strength field (strict|soft)`);
    }
  }

  // 11. SAFETY: T14 must never be a recommendation ---------------
  for (const r of (ctx.recommendations || [])) {
    if (r.id === 'T14') {
      errors.push('SAFETY VIOLATION: T14 Operational Friction Signal emitted as recommendation');
    }
  }

  // 12. SAFETY: T09 may not fire without severity data -----------
  for (const r of [...(ctx.recommendations || []), ...(ctx.observations || [])]) {
    if (r.id === 'T09' && !d.hasSeverityData) {
      errors.push('SAFETY VIOLATION: T09 fired without derived.hasSeverityData');
    }
  }

  // 13. Observation shape (single + combined) --------------------
  const VALID_OBS_TYPES = new Set(['observation', 'combinedObservation']);
  for (const o of (ctx.observations || [])) {
    if (!VALID_OBS_TYPES.has(o.type)) {
      errors.push(`observation ${o.id} has unexpected type=${o.type}`);
    }
    if (!o.note) {
      errors.push(`observation ${o.id} missing note field`);
    }
    if (o.action) {
      errors.push(`observation ${o.id} must not carry an action field`);
    }
    // Combined blocks must carry source attribution
    if (o.type === 'combinedObservation' && (!o.sources || !o.sources.length)) {
      errors.push(`combinedObservation ${o.id} missing sources array`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = { validateReport, LOCKED_KPI_ORDER, VARIANT_CAPS, MIN_CONFIDENCE };
