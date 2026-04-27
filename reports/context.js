'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/context.js
//  View-model builders. Each builder returns a plain-object context
//  consumed by a Handlebars template. No rendering or I/O here.
//
//  Exports:
//    buildSmokeContext(opts)
//    buildMonthlyBranchContext(rows, opts) → monthlyBranch ctx
//    buildMonthlyGlobalContext(rows, opts) → monthlyGlobal ctx
//    buildAnnualContext(rows, opts)        → annual ctx
// ══════════════════════════════════════════════════════════════════

const { buildReportContext } = require('./content/index');
const { prepareRows } = require('./content/kpi');

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
  return lang === 'ko'
    ? `${year}년 ${MONTHS_KO[month]}`
    : `${MONTHS_EN[month]} ${year}`;
}

// ── Pure aggregation utilities ───────────────────────────────────

function countByKey(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const v = (r[key] != null ? String(r[key]) : '').trim();
    if (!v || v === '—' || v === '-' || v === '--') continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return m;
}

function topNEntries(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function pctStr(r, digits) {
  if (r == null || !isFinite(r)) return '—';
  const f = 10 ** (digits == null ? 1 : digits);
  return `${Math.round(r * 100 * f) / f}%`;
}

function toBarRows(entries, total) {
  if (!entries.length) return [];
  const maxCount = entries[0][1] || 1;
  return entries.map(([name, count]) => ({
    name,
    count,
    pct: pctStr(total ? count / total : 0),
    barW: Math.round(count / maxCount * 100),
    valLabel: `${count} (${pctStr(total ? count / total : 0)})`,
  }));
}

function localMedian(arr) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function topNameFromMap(map) {
  let best = null, bestCount = 0;
  for (const [k, v] of map) {
    if (v > bestCount) { best = k; bestCount = v; }
  }
  return best;
}

function fmtMin(m, lang) {
  if (m == null || !isFinite(m)) return '—';
  return lang === 'ko' ? `${Math.round(m)}분` : `${Math.round(m)} min`;
}

// Field-name helpers (real data may use "Issue Category", "Action Type" etc.)
function getCategory(r) {
  return (r['Issue Category'] || r.Category || '').trim();
}
function getDifficulty(r) {
  const v = r['Issue Difficulty'] != null ? r['Issue Difficulty'] : r.Difficulty;
  return Number(v);
}
function getActionType(r) {
  return (r['Action Type'] || r.ActionType || '').trim();
}
function getIssueDetail(r) {
  return (r['Issue Detail'] || r.IssueDetail || '').trim();
}
function getActionTaken(r) {
  return (r['Action Taken'] || r.ActionTaken || '').trim();
}
function getSolvedBy(r) {
  return (r['Solved By'] || r.SolvedBy || '').trim();
}

// ── Visual aggregates builder ─────────────────────────────────────
//
// Computes all chart-ready data arrays from prepared rows.
// All bar widths, percentages, and sort orders are resolved here;
// Handlebars templates remain logic-free.

function buildVisualContext(prepared, opts) {
  const lang = opts.lang === 'ko' ? 'ko' : 'en';
  const variant = opts.variant || 'monthlyBranch';
  const included = prepared.filter(r => !r._excluded);
  const total = included.length;

  // ── Branch distribution ──────────────────────────────────────
  const branchMap = countByKey(included, 'Branch');
  const branchEntries = topNEntries(branchMap, 8);
  const branchSorted = toBarRows(branchEntries, total);

  // ── Zone distribution ────────────────────────────────────────
  const zoneMap = countByKey(included, 'Zone');
  const zoneEntries = topNEntries(zoneMap, 7);
  const zoneSorted = toBarRows(zoneEntries, total);

  // ── Category distribution ────────────────────────────────────
  const catMap = new Map();
  for (const r of included) {
    const v = getCategory(r);
    if (!v) continue;
    catMap.set(v, (catMap.get(v) || 0) + 1);
  }
  const catEntries = topNEntries(catMap, 7);
  const categorySorted = toBarRows(catEntries, total);

  // ── Action type ──────────────────────────────────────────────
  const atRaw = new Map();
  for (const r of included) {
    const at = getActionType(r);
    if (!at) continue;
    const key = /on.?site/i.test(at) ? 'On-Site'
      : /remote/i.test(at) ? 'Remote'
      : at;
    atRaw.set(key, (atRaw.get(key) || 0) + 1);
  }
  const atEntries = [...atRaw.entries()].sort((a, b) => b[1] - a[1]);
  let actionTypeSorted;
  if (atEntries.length === 0) {
    actionTypeSorted = [];
  } else if (atEntries.length <= 3) {
    actionTypeSorted = toBarRows(atEntries, total);
  } else {
    const top3 = atEntries.slice(0, 3);
    const otherCount = atEntries.slice(3).reduce((s, [, c]) => s + c, 0);
    const combined = otherCount > 0
      ? [...top3, [lang === 'ko' ? '기타' : 'Other', otherCount]]
      : top3;
    actionTypeSorted = toBarRows(combined, total);
  }

  // ── Time taken buckets ───────────────────────────────────────
  const bktLabels = lang === 'ko'
    ? ['15분 이하', '16–30분', '31–60분', '60분 초과']
    : ['≤15 min', '16–30 min', '31–60 min', '>60 min'];
  const bkt = [0, 0, 0, 0];
  for (const r of included) {
    const m = r._minutes;
    if (!isFinite(m) || m <= 0) continue;
    if (m <= 15) bkt[0]++;
    else if (m <= 30) bkt[1]++;
    else if (m <= 60) bkt[2]++;
    else bkt[3]++;
  }
  const bktMax = Math.max(...bkt, 1);
  const timeTakenBuckets = bktLabels.map((label, i) => ({
    label,
    count: bkt[i],
    pct: pctStr(total ? bkt[i] / total : 0),
    barW: Math.round(bkt[i] / bktMax * 100),
    valLabel: `${bkt[i]} (${pctStr(total ? bkt[i] / total : 0)})`,
  }));

  // ── Difficulty distribution ──────────────────────────────────
  const diffCnt = [0, 0, 0, 0, 0];
  for (const r of included) {
    const d = Math.round(getDifficulty(r));
    if (isFinite(d) && d >= 1 && d <= 5) diffCnt[d - 1]++;
  }
  const diffMax = Math.max(...diffCnt, 1);
  const difficultyDistribution = diffCnt.map((count, i) => ({
    label: `Lv.${i + 1}`,
    count,
    pct: pctStr(total ? count / total : 0),
    barW: Math.round(count / diffMax * 100),
    valLabel: `${count} (${pctStr(total ? count / total : 0)})`,
  }));

  // ── Daily trend ──────────────────────────────────────────────
  const dayMap = new Map();
  for (const r of included) {
    if (!r._date) continue;
    const k = r._date.toISOString().slice(0, 10);
    dayMap.set(k, (dayMap.get(k) || 0) + 1);
  }
  const dayEntries = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const dayMaxCount = Math.max(...dayEntries.map(([, c]) => c), 1);
  const peakDayEntry = dayEntries.reduce(
    (best, e) => e[1] > (best ? best[1] : 0) ? e : best, null
  );
  const dailyTrend = dayEntries.map(([date, count]) => ({
    date,
    dateLabel: date.slice(5).replace('-', '/'),
    count,
    barH: Math.round(count / dayMaxCount * 100),
    isPeak: peakDayEntry && date === peakDayEntry[0],
    isLatest: false,
  }));
  if (dailyTrend.length > 0) dailyTrend[dailyTrend.length - 1].isLatest = true;

  // ── Monthly trend (annual) ───────────────────────────────────
  const monMap = new Map();
  for (const r of included) {
    if (!r._date) continue;
    const k = `${r._date.getFullYear()}-${String(r._date.getMonth() + 1).padStart(2, '0')}`;
    monMap.set(k, (monMap.get(k) || 0) + 1);
  }
  const monEntries = [...monMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const monMaxCount = Math.max(...monEntries.map(([, c]) => c), 1);
  const peakMonEntry = monEntries.reduce(
    (best, e) => e[1] > (best ? best[1] : 0) ? e : best, null
  );
  const monthlyTrend = monEntries.map(([k, count]) => {
    const mIdx = parseInt(k.slice(5)) - 1;
    return {
      key: k,
      monthLabel: lang === 'ko' ? `${mIdx + 1}월` : MONTHS_EN[mIdx].slice(0, 3),
      count,
      barH: Math.round(count / monMaxCount * 100),
      isPeak: peakMonEntry && k === peakMonEntry[0],
      isLatest: false,
    };
  });
  if (monthlyTrend.length > 0) monthlyTrend[monthlyTrend.length - 1].isLatest = true;

  // ── Top repeated issues ──────────────────────────────────────
  // Group by Zone + Category + Issue text
  const SENTINEL = new Set(['-', '--', 'n/a', 'na', 'none', 'tbd', '미정', '없음', '해당없음']);
  const issueMap = new Map();
  for (const r of included) {
    const zone = (r.Zone || '').trim();
    const cat = getCategory(r);
    const issueRaw = getIssueDetail(r) || getActionTaken(r);
    const key = `${zone}||${cat}||${issueRaw.slice(0, 60)}`;
    if (!issueMap.has(key)) {
      issueMap.set(key, { zone, category: cat, issue: issueRaw, count: 0 });
    }
    issueMap.get(key).count++;
  }
  const topRepeatedIssues = [...issueMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((e, i) => ({
      rank: i + 1,
      zone: e.zone || '—',
      category: e.category || '—',
      count: e.count,
      issue: e.issue || '—',
    }));

  // ── Issue cluster cards ──────────────────────────────────────
  const clMap = new Map();
  for (const r of included) {
    const zone = (r.Zone || '').trim();
    const cat = getCategory(r);
    const key = `${zone}||${cat}`;
    if (!clMap.has(key)) {
      clMap.set(key, { zone, cat, count: 0, rows: [], branches: new Set(), months: new Set() });
    }
    const e = clMap.get(key);
    e.count++;
    e.rows.push(r);
    if (r.Branch) e.branches.add(r.Branch);
    if (r._date) {
      e.months.add(`${r._date.getFullYear()}-${String(r._date.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  const repeatedIssueClusters = [...clMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(e => {
      const iFreq = new Map();
      const aFreq = new Map();
      for (const r of e.rows) {
        const i = getIssueDetail(r);
        const a = getActionTaken(r);
        if (i) iFreq.set(i, (iFreq.get(i) || 0) + 1);
        if (a && a.length >= 3 && !SENTINEL.has(a.toLowerCase())) {
          aFreq.set(a, (aFreq.get(a) || 0) + 1);
        }
      }
      const topIssue = [...iFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      const topAction = [...aFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      return {
        title: topIssue,
        count: e.count,
        zone: e.zone || '—',
        category: e.cat || '—',
        branches: [...e.branches].slice(0, 3).join(', ') || '—',
        monthsAppeared: e.months.size,
        actionTaken: topAction,
      };
    });

  // ── Recent incident log ──────────────────────────────────────
  const recentIncidentLog = [...included]
    .filter(r => r._date)
    .sort((a, b) => b._date - a._date)
    .slice(0, 12)
    .map(r => ({
      date: r._date.toISOString().slice(0, 10),
      time: r.Time || '—',
      branch: r.Branch || '—',
      zone: r.Zone || '—',
      category: getCategory(r) || '—',
      timeTaken: isFinite(r._minutes) && r._minutes > 0 ? fmtMin(r._minutes, lang) : '—',
      actionType: getActionType(r) || '—',
      issueDetail: getIssueDetail(r) || '—',
    }));

  // ── Detailed incident log (branch page 2) ────────────────────
  const detailedIncidentLog = [...included]
    .filter(r => r._date)
    .sort((a, b) => b._date - a._date)
    .slice(0, 15)
    .map(r => ({
      date: r._date.toISOString().slice(0, 10),
      time: r.Time || '—',
      zone: r.Zone || '—',
      category: getCategory(r) || '—',
      timeTaken: isFinite(r._minutes) && r._minutes > 0 ? fmtMin(r._minutes, lang) : '—',
      actionType: getActionType(r) || '—',
      issueDetail: getIssueDetail(r) || '—',
      actionTaken: getActionTaken(r) || '—',
    }));

  // ── Zone × Category matrix ───────────────────────────────────
  const topZoneNames = topNEntries(zoneMap, 5).map(([n]) => n);
  const topCatNames = topNEntries(catMap, 5).map(([n]) => n);
  let matMax = 0;
  const matRawRows = topZoneNames.map(zone => {
    const cells = topCatNames.map(cat =>
      included.filter(r => r.Zone === zone && getCategory(r) === cat).length
    );
    cells.forEach(c => { if (c > matMax) matMax = c; });
    return { zone, cells };
  });
  const zoneCategoryMatrix = {
    categories: topCatNames,
    rows: matRawRows.map(({ zone, cells }) => ({
      zone,
      cells: cells.map(count => ({
        count,
        intensityClass: matMax > 0 && count > 0
          ? (count / matMax >= 0.66 ? 'hi' : count / matMax >= 0.33 ? 'mid' : 'lo')
          : '',
      })),
    })),
  };

  // ── Branch comparison rows ────────────────────────────────────
  const branchComparisonRows = branchEntries.map(([branch, count]) => {
    const bRows = included.filter(r => r.Branch === branch);
    const durs = bRows.filter(r => isFinite(r._minutes) && r._minutes > 0).map(r => r._minutes);
    const med = localMedian(durs);
    const bZone = topNameFromMap(countByKey(bRows, 'Zone')) || '—';
    const bCatMap = new Map();
    for (const r of bRows) {
      const v = getCategory(r);
      if (v) bCatMap.set(v, (bCatMap.get(v) || 0) + 1);
    }
    const bCat = topNameFromMap(bCatMap) || '—';
    const bHighDiff = bRows.filter(r => getDifficulty(r) >= 4).length;
    return {
      branch,
      total: count,
      share: pctStr(total ? count / total : 0),
      topZone: bZone,
      topCategory: bCat,
      highDifficulty: bHighDiff,
      medianResolve: isFinite(med) ? fmtMin(med, lang) : '—',
    };
  });

  // ── Solver distribution (branch report) ─────────────────────
  const solverMap = new Map();
  for (const r of included) {
    const v = getSolvedBy(r);
    if (!v) continue;
    solverMap.set(v, (solverMap.get(v) || 0) + 1);
  }
  const solverEntries = topNEntries(solverMap, 8);
  const solverSorted = toBarRows(solverEntries, total);

  // ── Scalar metrics ────────────────────────────────────────────
  const activeDays = dayMap.size;
  const dateTimes = included.filter(r => r._date).map(r => r._date.getTime());
  let calDays = 30;
  if (dateTimes.length >= 2) {
    const span = Math.max(...dateTimes) - Math.min(...dateTimes);
    calDays = Math.max(Math.round(span / 86400000) + 1, 1);
  }
  const dailyAvg = total ? (total / calDays).toFixed(1) : '0';
  const activeDayAvg = activeDays ? (total / activeDays).toFixed(1) : '—';
  const monthlyAvg = monEntries.length ? (total / monEntries.length).toFixed(1) : '—';
  const topBranchName = branchEntries.length ? branchEntries[0][0] : null;

  // Trend navigation labels
  const dailyTrendFirst = dailyTrend.length ? dailyTrend[0].dateLabel : '';
  const dailyTrendLast = dailyTrend.length ? dailyTrend[dailyTrend.length - 1].dateLabel : '';
  const dailyTrendPeak = peakDayEntry ? peakDayEntry[1] : 0;
  const dailyTrendLatest = dailyTrend.length ? dailyTrend[dailyTrend.length - 1].count : 0;
  const monthlyTrendFirst = monthlyTrend.length ? monthlyTrend[0].monthLabel : '';
  const monthlyTrendLast = monthlyTrend.length ? monthlyTrend[monthlyTrend.length - 1].monthLabel : '';
  const monthlyTrendPeak = peakMonEntry ? peakMonEntry[1] : 0;
  const monthlyTrendLatest = monthlyTrend.length ? monthlyTrend[monthlyTrend.length - 1].count : 0;

  return {
    // Distributions
    branchSorted,
    zoneSorted,
    categorySorted,
    actionTypeSorted,
    timeTakenBuckets,
    difficultyDistribution,
    // Trend arrays
    dailyTrend,
    dailyTrendFirst,
    dailyTrendLast,
    dailyTrendPeak,
    dailyTrendLatest,
    monthlyTrend,
    monthlyTrendFirst,
    monthlyTrendLast,
    monthlyTrendPeak,
    monthlyTrendLatest,
    // Evidence tables
    topRepeatedIssues,
    repeatedIssueClusters,
    recentIncidentLog,
    detailedIncidentLog,
    // Matrix + comparison
    zoneCategoryMatrix,
    branchComparisonRows,
    solverSorted,
    // Scalars
    dailyAvg,
    activeDayAvg,
    monthlyAvg,
    topBranchName,
    activeDays,
    calDays,
    hasData: total > 0,
  };
}

// ── Spec-compliant 8-KPI builder ──────────────────────────────────

function buildSpecKpis(derived, visual, opts) {
  const { lang, variant } = opts;
  const {
    totalCount,
    highDifficultyCount, highDifficultyShare,
    medianResolveMin,
    topCategoryName, topCategoryShare,
  } = derived;
  const { dailyAvg, activeDayAvg, monthlyAvg, topBranchName, zoneSorted } = visual;

  // Top zone from visual (works for all variants including monthlyBranch)
  const topZone = zoneSorted.length ? zoneSorted[0].name : '—';
  const topZonePct = zoneSorted.length && totalCount
    ? pctStr(zoneSorted[0].count / totalCount) : '—';

  function hi(val, warn, crit) {
    if (val == null || !isFinite(val)) return 'brand';
    return val >= crit ? 'crit' : val >= warn ? 'warn' : 'ok';
  }

  const k1 = {
    id: 'K1',
    label: lang === 'ko' ? '총 오류 건수' : 'Total Incidents',
    value: totalCount,
    formatted: totalCount.toLocaleString('en-US'),
    accent: 'brand',
  };

  let k2;
  if (variant === 'annual') {
    k2 = {
      id: 'K2',
      label: lang === 'ko' ? '월 평균 건수' : 'Monthly Avg',
      value: monthlyAvg,
      formatted: monthlyAvg,
      unit: lang === 'ko' ? '건/월' : '/mo',
      accent: 'brand',
    };
  } else {
    k2 = {
      id: 'K2',
      label: lang === 'ko' ? '전월 대비' : 'MoM Delta',
      value: null,
      formatted: 'N/A',
      hint: lang === 'ko' ? '이전 데이터 없음' : 'No prior data',
      accent: 'brand',
    };
  }

  const k3 = {
    id: 'K3',
    label: lang === 'ko' ? '일 평균 발생' : 'Daily Avg',
    value: dailyAvg,
    formatted: dailyAvg,
    accent: 'brand',
  };

  const k4 = {
    id: 'K4',
    label: lang === 'ko' ? '발생일 기준 평균' : 'Active-Day Avg',
    value: activeDayAvg,
    formatted: activeDayAvg,
    accent: 'brand',
  };

  const k5 = {
    id: 'K5',
    label: lang === 'ko' ? '처리 난이도 높음' : 'High-Difficulty',
    hint: lang === 'ko' ? '보고 기준 Lv.4+' : 'Reported Lv.4+',
    value: highDifficultyCount,
    formatted: `${(highDifficultyCount || 0).toLocaleString('en-US')} (${pctStr(highDifficultyShare)})`,
    accent: 'brand',
  };

  const k6 = {
    id: 'K6',
    label: lang === 'ko' ? '평균 처리 시간' : 'Median Resolve',
    value: medianResolveMin,
    formatted: isFinite(medianResolveMin)
      ? (lang === 'ko' ? `${Math.round(medianResolveMin)}분` : `${Math.round(medianResolveMin)} min`)
      : '—',
    accent: hi(medianResolveMin, 60, 120),
  };

  const k7 = {
    id: 'K7',
    label: lang === 'ko' ? '주요 발생 존' : 'Top Zone',
    value: topZone,
    formatted: `${topZone} (${topZonePct})`,
    accent: 'brand',
  };

  // K8: Most Active Branch for annual, else Top Category
  const k8 = (variant === 'annual' && topBranchName)
    ? {
        id: 'K8',
        label: lang === 'ko' ? '최다 발생 지점' : 'Most Active Branch',
        value: topBranchName,
        formatted: topBranchName,
        accent: 'brand',
      }
    : {
        id: 'K8',
        label: lang === 'ko' ? '주요 오류 유형' : 'Top Category',
        value: topCategoryName,
        formatted: `${topCategoryName || '—'} (${pctStr(topCategoryShare)})`,
        accent: 'brand',
      };

  return [k1, k2, k3, k4, k5, k6, k7, k8];
}

// ── Extended labels ───────────────────────────────────────────────

function buildExtLabels(lang, variant) {
  const ko = lang === 'ko';
  const reportTypeTitle = variant === 'annual'
    ? (ko ? '연간 에러 리포트' : 'Annual Error Report')
    : (ko ? '월간 에러 리포트' : 'Monthly Error Report');

  return {
    reportTypeTitle,
    // Section titles
    incidentsByBranch:    ko ? '지점별 오류 현황'  : 'Incidents by Branch',
    dailyTrendTitle:      ko ? '일별 추이'         : 'Daily Trend',
    zoneDistribution:     ko ? '존별 분포'         : 'Zone Distribution',
    categoryDistribution: ko ? '오류 유형 분포'    : 'Category Distribution',
    resolveTimeDist:      ko ? '처리 시간 분포'    : 'Resolve Time',
    actionTypeDist:       ko ? '처리 방식'         : 'Action Type',
    reportedDifficulty:   ko ? '처리 난이도'       : 'Reported Difficulty',
    topRepeatedIssues:    ko ? '주요 반복 오류'    : 'Top Repeated Issues',
    issueClusters:        ko ? '오류 군집'         : 'Issue Clusters',
    recentLog:            ko ? '최근 오류 로그'    : 'Recent Incident Log',
    detailedLog:          ko ? '상세 오류 로그'    : 'Detailed Incident Log',
    monthlyTrendTitle:    ko ? '월별 추이'         : 'Monthly Trend',
    branchDistribution:   ko ? '지점별 분포'       : 'Branch Distribution',
    yearlyRepeated:       ko ? '연간 주요 반복 오류': 'Top Yearly Repeated Issues',
    yearlyIssueClusters:  ko ? '연간 오류 군집'   : 'Yearly Issue Clusters',
    branchComparison:     ko ? '지점별 비교'       : 'Branch Comparison',
    zoneCategoryMatrix:   ko ? '존 × 유형 교차'   : 'Zone × Category Matrix',
    solverDistribution:   ko ? '담당자별 현황'     : 'Handled By Distribution',
    // Table columns
    colRank:          '#',
    colZone:          ko ? '존'       : 'Zone',
    colCategory:      ko ? '유형'     : 'Category',
    colCount:         ko ? '건수'     : 'Count',
    colIssue:         ko ? '주요 오류 내용' : 'Representative Issue',
    colAction:        ko ? '주요 조치'  : 'Representative Action',
    colMonths:        ko ? '발생 월'   : 'Months',
    colDate:          ko ? '일자'     : 'Date',
    colTime:          ko ? '시간'     : 'Time',
    colBranch:        ko ? '지점'     : 'Branch',
    colTimeTaken:     ko ? '처리 시간' : 'Time Taken',
    colActionType:    ko ? '처리 방식' : 'Action Type',
    colIssueDetail:   ko ? '오류 내용' : 'Issue Detail',
    colActionTaken:   ko ? '조치 내용' : 'Action Taken',
    colTotal:         ko ? '총계'     : 'Total',
    colShare:         ko ? '비율'     : 'Share',
    colTopZone:       ko ? '주요 존'   : 'Top Zone',
    colTopCategory:   ko ? '주요 유형' : 'Top Category',
    colHighDiff:      ko ? '난이도↑'   : 'Hi-Diff',
    colMedianResolve: ko ? '중앙 처리' : 'Med.Resolve',
    colDifficulty:    ko ? '난이도'    : 'Difficulty',
    // Zero-data message
    noData: ko
      ? '해당 기간 발생한 오류가 없습니다.'
      : 'No incidents recorded during this period.',
    // Scope fallback
    allBranches: ko ? '전체 지사' : 'All Branches',
    // Trend labels
    peakLabel:   ko ? '최고' : 'Peak',
    latestLabel: ko ? '최근' : 'Latest',
    // Misc
    monthsLabel: ko ? '개월' : 'mo',
    casesLabel:  ko ? '건'   : 'cases',
    branchLabel: ko ? '지점' : 'Branch',
  };
}

// ── Core builder ──────────────────────────────────────────────────

function buildV2Context(rows, opts = {}) {
  const lang      = opts.lang === 'ko' ? 'ko' : 'en';
  const variant   = opts.variant || 'monthlyBranch';
  const period    = opts.period  || '';
  const scope     = opts.scope   || null;
  const now       = opts.now     || new Date();
  const generated = opts.generated || fmtDate(now, lang);

  // Run content pipeline (safety engine, narrative, recommendations)
  const ctx = buildReportContext(rows, {
    lang, variant, period, scope, generated,
    priorMedianResolveMin: opts.priorMedianResolveMin || null,
  });

  // Prepare rows for visual aggregates (same opts as inside buildReportContext)
  const prepared = prepareRows(rows, opts);

  // Build all chart-ready aggregates
  const visual = buildVisualContext(prepared, { lang, variant });

  // Build spec-compliant 8-KPI array
  const specKpis = buildSpecKpis(ctx.derived, visual, { lang, variant });

  // Extended labels merged over content-layer labels
  const extLabels = buildExtLabels(lang, variant);
  const labels = Object.assign(
    { page: lang === 'ko' ? '페이지' : 'Page' },
    ctx.labels,
    extLabels
  );

  // Doc title
  const titleParts = [
    extLabels.reportTypeTitle,
    scope || extLabels.allBranches,
    period,
  ].filter(Boolean);
  const docTitle = `${titleParts.join(' · ')} — d'strict GTO`;

  return Object.assign({}, ctx, visual, {
    kpis: specKpis,
    kpiColumns: '8',
    docTitle,
    generated,
    period,
    scope,
    labels,
  });
}

// ── Public builders ───────────────────────────────────────────────

function buildMonthlyBranchContext(rows, opts = {}) {
  return buildV2Context(rows, Object.assign({}, opts, { variant: 'monthlyBranch' }));
}

function buildMonthlyGlobalContext(rows, opts = {}) {
  return buildV2Context(rows, Object.assign({}, opts, { variant: 'monthlyGlobal' }));
}

function buildAnnualContext(rows, opts = {}) {
  return buildV2Context(rows, Object.assign({}, opts, { variant: 'annual' }));
}

// ── Smoke-test context (unchanged) ────────────────────────────────

const SMOKE_LABELS = {
  en: { period: 'Period', scope: 'Scope', generated: 'Generated', version: 'Version',
        executiveSummary: 'Executive Summary', snapshot: 'Operational snapshot', page: 'Page' },
  ko: { period: '기간', scope: '범위', generated: '생성일', version: '버전',
        executiveSummary: '경영 요약', snapshot: '운영 스냅샷', page: '페이지' },
};

const SMOKE_COPY = {
  en: {
    eyebrow:  'd’strict · Global Tech Ops',
    headline: 'Smoke Test — HTML/CSS Reporting Engine',
    subhead:  'Layout, typography, grid, pagination, and bilingual font loading verified end-to-end.',
    orgLine:  'Global Tech Operations',
    narrative:
      'This page confirms the v2 reporting pipeline is rendering with a real layout engine: ' +
      'fonts load via <strong>@font-face</strong>, KPIs are placed on a CSS grid, and page breaks ' +
      'are driven by <strong>@page</strong> rules rather than manual y-coordinate accounting.',
  },
  ko: {
    eyebrow:  'd’strict · Global Tech Ops',
    headline: '스모크 테스트 — HTML/CSS 리포팅 엔진',
    subhead:  '레이아웃, 타이포그래피, 그리드, 페이지네이션, 이중 언어 폰트 로딩을 엔드-투-엔드로 검증합니다.',
    orgLine:  'Global Tech Operations',
    narrative:
      'v2 리포팅 파이프라인이 실제 레이아웃 엔진 위에서 동작함을 확인하는 페이지입니다. ' +
      '폰트는 <strong>@font-face</strong>로 로드되고 KPI는 CSS 그리드에 배치됩니다.',
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
      version:   'v2.0',
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
  _helpers: { periodLabel, fmtDate },
};
