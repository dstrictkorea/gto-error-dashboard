'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/content/kpi.js
//
//  Pure KPI computation. Single source of truth for every numeric
//  fact in the report. Narrative / recommendations consume this
//  output; they never recompute.
//
//  SAFETY LOCKS (do not relax):
//    · isCritical(row) uses Severity === 'Critical' ONLY.
//      Difficulty is NEVER a proxy for severity, business impact, or
//      escalation urgency. See Difficulty Safety Rule.
//    · "Reporting Completeness" (K5) is a record-completeness metric,
//      not an SLA / resolution-quality metric.
//    · KPI ordering K1 → K2 → K3 → K4 → K5 → K6 → K7 is locked.
//
//  Difficulty exposure (context only):
//    derived.highDifficultyCount / .highDifficultyShare are provided
//    for narrative context. They are labelled "reported" in all
//    surfaces and never drive recommendations on their own.
//
//  Exports:
//    buildKpi(rows, opts), prepareRows(rows, opts)
//    isCritical, isHighDifficulty, isReportingComplete
// ══════════════════════════════════════════════════════════════════

const SENTINEL_ACTION = new Set([
  '-', '--', 'n/a', 'na', 'none', 'tbd', 'tba',
  '미정', '없음', '확인중', '해당없음', '-없음-',
]);
const LOW_CONF_THRESHOLD = 0.05;

// ── Parsers ──────────────────────────────────────────────────────

function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseMinutes(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return (isFinite(v) && v > 0) ? v : null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  const colon = s.match(/^(\d+):(\d{1,2})$/);
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);

  const hMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|시간)/);
  const mMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes|분)/);
  if (hMatch || mMatch) {
    const total = (parseFloat(hMatch ? hMatch[1] : '0') * 60) + parseFloat(mMatch ? mMatch[1] : '0');
    return total > 0 ? total : null;
  }

  const n = parseFloat(s);
  return (isFinite(n) && n > 0) ? n : null;
}

function parseHour(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (v >= 0 && v < 1) return v * 24;
    return null;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!isFinite(h) || h < 0 || h > 23) return null;
  return h + (isFinite(mm) ? mm / 60 : 0);
}

function dayKey(d) {
  // UTC ISO date, stable across timezones for bucketing purposes.
  return d.toISOString().slice(0, 10);
}

// ── Classifiers (single source; re-exported on derived.classifiers) ──

// CRITICAL: Difficulty is NEVER accepted as a severity proxy.
function isCritical(row) {
  if (!row) return false;
  const sev = (row.Severity == null ? '' : String(row.Severity)).trim().toLowerCase();
  return sev === 'critical';
}

// Difficulty-based signal — context only, not a recommendation trigger.
function isHighDifficulty(row) {
  if (!row) return false;
  const d = Number(row.Difficulty);
  return isFinite(d) && d >= 4;
}

function isReportingComplete(row) {
  if (!row || row._excluded) return false;
  if (!isFinite(row._minutes) || row._minutes <= 0) return false;
  const a = (row.ActionTaken == null ? '' : String(row.ActionTaken)).trim();
  if (a.length < 3) return false;
  if (SENTINEL_ACTION.has(a.toLowerCase())) return false;
  return true;
}

function hasSeverityField(rows) {
  return (rows || []).some(r => r && (r.Severity != null) && String(r.Severity).trim() !== '');
}

// ── Row preparation ──────────────────────────────────────────────

function prepareRow(row, periodStart, periodEnd) {
  const _date = parseDate(row.Date);
  const _minutes = parseMinutes(row.TimeTaken);
  const _hour = parseHour(row.Time);
  let _excluded = false;
  let _excludeReason = null;
  if (!_date) { _excluded = true; _excludeReason = 'missing_date'; }
  else if (periodStart && _date < periodStart) { _excluded = true; _excludeReason = 'out_of_period'; }
  else if (periodEnd && _date > periodEnd) { _excluded = true; _excludeReason = 'out_of_period'; }
  return Object.assign({}, row, { _date, _minutes, _hour, _excluded, _excludeReason });
}

function prepareRows(rows, opts = {}) {
  const periodStart = opts.periodStart ? parseDate(opts.periodStart) : null;
  const periodEnd = opts.periodEnd ? parseDate(opts.periodEnd) : null;
  return (Array.isArray(rows) ? rows : []).map(r => prepareRow(r || {}, periodStart, periodEnd));
}

// ── Aggregators ──────────────────────────────────────────────────

function median(nums) {
  if (!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k == null || k === '') continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

function topFromCounts(counts) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) return { name: null, count: 0, share: null };
  let name = null, count = 0;
  for (const [k, v] of counts) if (v > count) { name = k; count = v; }
  return { name, count, share: count / total };
}

function top(rows, keyFn) {
  return topFromCounts(countBy(rows, keyFn));
}

// Evidence profile for a filtered row set: n, distinctDays, maxDayShare.
function evidenceProfile(rows) {
  if (!rows || rows.length === 0) {
    return { n: 0, distinctDays: 0, maxDayShare: null };
  }
  const byDay = new Map();
  for (const r of rows) {
    if (!r._date) continue;
    const k = dayKey(r._date);
    byDay.set(k, (byDay.get(k) || 0) + 1);
  }
  if (byDay.size === 0) {
    return { n: rows.length, distinctDays: 0, maxDayShare: null };
  }
  let maxDay = 0;
  for (const v of byDay.values()) if (v > maxDay) maxDay = v;
  return {
    n: rows.length,
    distinctDays: byDay.size,
    maxDayShare: maxDay / rows.length,
  };
}

// ── Confidence (data-level: rows-excluded) ───────────────────────

function computeConfidence(rawCount, excludedCount) {
  if (rawCount === 0) {
    return { level: 'full', ratio: 0, excludedCount: 0, excludedPct: 0, rawCount: 0 };
  }
  const ratio = excludedCount / rawCount;
  return {
    level: ratio >= LOW_CONF_THRESHOLD ? 'low' : 'full',
    ratio,
    excludedCount,
    excludedPct: Math.round(ratio * 100),
    rawCount,
  };
}

// ── Formatting ───────────────────────────────────────────────────

function fmtInt(n)  { return (n == null || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US'); }
function fmtPct(p, digits) {
  if (p == null || !isFinite(p)) return '—';
  const f = 10 ** (digits == null ? 1 : digits);
  return `${Math.round(p * 100 * f) / f}%`;
}
function fmtMins(m) { return (m == null || !isFinite(m)) ? '—' : `${Math.round(m)} min`; }
function fmtName(s) {
  if (s == null) return '—';
  const t = String(s).trim();
  return t === '' ? '—' : t;
}

// ── Main ─────────────────────────────────────────────────────────

function buildKpi(rows, opts = {}) {
  const variant = opts.variant || 'monthlyBranch';
  const prepared = opts.prepared ? rows : prepareRows(rows, opts);

  const all = Array.isArray(prepared) ? prepared : [];
  const included = all.filter(r => !r._excluded);
  const excludedRows = all.filter(r => r._excluded);
  const excludedByReason = {};
  for (const r of excludedRows) {
    excludedByReason[r._excludeReason] = (excludedByReason[r._excludeReason] || 0) + 1;
  }
  const confidence = computeConfidence(all.length, excludedRows.length);
  const kpiConf = confidence.level;

  const hasSeverity = hasSeverityField(included);

  // Severity-based critical (the only valid "critical" signal) ───
  const critRows = included.filter(isCritical);
  const criticalCount = hasSeverity ? critRows.length : 0;
  const criticalShare = hasSeverity && included.length
    ? criticalCount / included.length
    : null;

  // Difficulty-based signal — contextual only ────────────────────
  const highDiffRows = included.filter(isHighDifficulty);
  const highDifficultyCount = highDiffRows.length;
  const highDifficultyShare = included.length
    ? highDifficultyCount / included.length
    : null;

  // Average reported difficulty (context, no actions) ────────────
  const diffs = included.map(r => Number(r.Difficulty)).filter(n => isFinite(n) && n >= 1 && n <= 5);
  const reportedDifficultyAvg = diffs.length
    ? diffs.reduce((a, b) => a + b, 0) / diffs.length
    : null;

  // Core operational KPIs ────────────────────────────────────────
  const durations = included.filter(r => isFinite(r._minutes) && r._minutes > 0).map(r => r._minutes);
  const medianResolveMin = median(durations);

  const topCat = top(included, r => r.Category);
  const topZone = (variant === 'monthlyBranch')
    ? { name: null, count: 0, share: null }
    : top(included, r => r.Zone);

  const completeRows = included.filter(isReportingComplete);
  const reportingCompleteness = included.length ? completeRows.length / included.length : null;

  // KPI card records ─────────────────────────────────────────────

  const k1 = {
    id: 'K1',
    label: 'Total Incidents',
    labelKo: '총 건수',
    value: included.length,
    formatted: fmtInt(included.length),
    unit: null,
    confidence: kpiConf,
    semantic: 'total_incidents',
  };

  // K2 — SEVERITY PREFERRED, DIFFICULTY AS EXPLICITLY LABELLED FALLBACK.
  // When Severity is absent, we surface Difficulty as "Reported
  // Difficulty" and never imply severity.
  const k2 = hasSeverity
    ? {
        id: 'K2',
        label: 'Critical',
        labelKo: '중대',
        value: criticalCount,
        share: criticalShare,
        formatted: `${fmtInt(criticalCount)} (${fmtPct(criticalShare)})`,
        confidence: kpiConf,
        semantic: 'severity_critical',
      }
    : {
        id: 'K2',
        label: 'High-Difficulty Reports',
        labelKo: '보고 난이도 4+ 건수',
        hint: 'Reported',
        hintKo: '보고 기준',
        value: highDifficultyCount,
        share: highDifficultyShare,
        formatted: `${fmtInt(highDifficultyCount)} (${fmtPct(highDifficultyShare)})`,
        confidence: kpiConf,
        semantic: 'reported_difficulty',
      };

  const k3 = {
    id: 'K3',
    label: 'Median Resolve',
    labelKo: '중앙 처리 시간',
    value: medianResolveMin,
    formatted: fmtMins(medianResolveMin),
    unit: 'min',
    confidence: kpiConf,
    semantic: 'median_resolve',
  };

  const k4 = {
    id: 'K4',
    label: 'Top Category',
    labelKo: '최다 카테고리',
    value: topCat.name,
    share: topCat.share,
    formatted: `${fmtName(topCat.name)} (${fmtPct(topCat.share)})`,
    confidence: kpiConf,
    semantic: 'top_category',
  };

  const k5 = {
    id: 'K5',
    label: 'Reporting Completeness',
    labelKo: '보고 완전성',
    value: reportingCompleteness,
    share: reportingCompleteness,
    formatted: fmtPct(reportingCompleteness),
    confidence: kpiConf,
    semantic: 'reporting_completeness',
  };

  const kpis = [k1, k2, k3, k4, k5];

  if (variant === 'monthlyGlobal' || variant === 'annual') {
    kpis.push({
      id: 'K6',
      label: 'Top Zone',
      labelKo: '최다 구역',
      value: topZone.name,
      share: topZone.share,
      formatted: `${fmtName(topZone.name)} (${fmtPct(topZone.share)})`,
      confidence: kpiConf,
      semantic: 'top_zone',
    });
  }

  if (variant === 'annual') {
    const prior = Array.isArray(opts.priorRows)
      ? (opts.priorPrepared ? opts.priorRows : prepareRows(opts.priorRows, opts)).filter(r => !r._excluded)
      : [];
    let delta = null, deltaPct = null;
    if (prior.length) {
      delta = included.length - prior.length;
      deltaPct = prior.length ? delta / prior.length : null;
    }
    kpis.push({
      id: 'K7',
      label: 'vs Prior Period',
      labelKo: '전년 대비',
      value: deltaPct,
      delta,
      formatted: (deltaPct == null) ? '—' : `${delta >= 0 ? '+' : ''}${fmtPct(deltaPct)}`,
      confidence: kpiConf,
      semantic: 'trend_vs_prior',
    });
  }

  // Secondary aggregates ─────────────────────────────────────────
  const categoryCounts = countBy(included, r => r.Category);
  const zoneCounts = countBy(included, r => r.Zone);

  // zone × category hotspot
  const zoneCatMap = new Map();
  for (const r of included) {
    const z = (r.Zone || '').trim();
    const c = (r.Category || '').trim();
    if (!z || !c) continue;
    const k = `${z}|${c}`;
    zoneCatMap.set(k, (zoneCatMap.get(k) || 0) + 1);
  }
  let topHotspot = { zone: null, category: null, count: 0, share: null };
  for (const [k, v] of zoneCatMap) {
    if (v > topHotspot.count) {
      const [z, c] = k.split('|');
      topHotspot = { zone: z, category: c, count: v, share: included.length ? v / included.length : null };
    }
  }

  // slowest category (n >= 5 required)
  const categoryDurations = new Map();
  for (const r of included) {
    if (!r.Category || !isFinite(r._minutes) || r._minutes <= 0) continue;
    if (!categoryDurations.has(r.Category)) categoryDurations.set(r.Category, []);
    categoryDurations.get(r.Category).push(r._minutes);
  }
  let slowestCategory = { name: null, median: null, n: 0 };
  for (const [name, arr] of categoryDurations) {
    if (arr.length < 5) continue;
    const m = median(arr);
    if (m != null && m > (slowestCategory.median || 0)) {
      slowestCategory = { name, median: m, n: arr.length };
    }
  }

  // after-hours rows
  const afterHoursRows = included.filter(r => {
    const h = r._hour;
    return isFinite(h) && (h >= 22 || h < 6);
  });
  const afterHoursShare = included.length ? afterHoursRows.length / included.length : null;

  // ── Evidence profiles (used by recommendations.js confidence gate) ─
  // Each profile: { n, distinctDays, maxDayShare }
  const hotspotRows = (topHotspot.zone && topHotspot.category)
    ? included.filter(r => (r.Zone || '').trim() === topHotspot.zone
                        && (r.Category || '').trim() === topHotspot.category)
    : [];
  const topCategoryRows = topCat.name
    ? included.filter(r => (r.Category || '').trim() === topCat.name)
    : [];
  const topZoneRows = topZone.name
    ? included.filter(r => (r.Zone || '').trim() === topZone.name)
    : [];
  const slowestCategoryRows = slowestCategory.name
    ? included.filter(r => (r.Category || '').trim() === slowestCategory.name)
    : [];

  const evidence = {
    all: evidenceProfile(included),
    severityCritical: evidenceProfile(hasSeverity ? critRows : []),
    highDifficulty: evidenceProfile(highDiffRows),
    topHotspot: evidenceProfile(hotspotRows),
    topCategory: evidenceProfile(topCategoryRows),
    topZone: evidenceProfile(topZoneRows),
    slowestCategory: evidenceProfile(slowestCategoryRows),
    afterHours: evidenceProfile(afterHoursRows),
    completeness: { n: included.length, distinctDays: evidenceProfile(included).distinctDays, maxDayShare: null },
  };

  // ── Derived context for downstream modules ────────────────────
  const derived = {
    variant,
    totalCount: included.length,

    // Severity (NEVER derived from Difficulty)
    hasSeverityData: hasSeverity,
    criticalCount,
    criticalShare,

    // Difficulty — contextual only
    highDifficultyCount,
    highDifficultyShare,
    reportedDifficultyAvg,

    // Core operational
    medianResolveMin,
    reportingCompleteness,
    topCategoryName: topCat.name,
    topCategoryShare: topCat.share,
    topZoneName: topZone.name,
    topZoneShare: topZone.share,
    slowestCategory,
    topHotspot,
    afterHoursCount: afterHoursRows.length,
    afterHoursShare,

    // Raw count maps (for template use)
    categoryCounts: Object.fromEntries(categoryCounts),
    zoneCounts: Object.fromEntries(zoneCounts),

    // Evidence profiles — consumed by recommendations confidence gate
    evidence,

    // Classifiers re-exported for single-source enforcement
    classifiers: { isCritical, isHighDifficulty, isReportingComplete },
  };

  return {
    kpis,
    confidence,
    excluded: { count: excludedRows.length, byReason: excludedByReason, rawCount: all.length },
    derived,
    _diagnostics: {
      rawCount: all.length,
      includedCount: included.length,
      excludedCount: excludedRows.length,
      durationsCount: durations.length,
      completeCount: completeRows.length,
      hasSeverity,
    },
  };
}

module.exports = {
  buildKpi,
  prepareRows,
  isCritical,
  isHighDifficulty,
  isReportingComplete,
  _internals: { parseDate, parseMinutes, parseHour, median, top, topFromCounts, countBy, evidenceProfile, hasSeverityField },
};
