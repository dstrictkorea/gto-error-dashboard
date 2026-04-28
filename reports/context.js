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

// Unit-aware count formatter — enforces "건" (KO) or "N errors/cases/reports" (EN)
function formatCount(n, type, lang) {
  if (lang === 'ko') return `${n}건`;
  const pluralSuffix = n === 1 ? '' : 's';
  if (type === 'errors')  return `${n} error${pluralSuffix}`;
  if (type === 'cases')   return `${n} case${pluralSuffix}`;
  if (type === 'reports') return `${n} report${pluralSuffix}`;
  return String(n);
}

function toBarRows(entries, total) {
  if (!entries.length) return [];
  const maxCount = entries[0][1] || 1;
  return entries.map(([name, count]) => ({
    name,
    count,
    pct: pctStr(total ? count / total : 0),
    barW: Math.round(count / maxCount * 100),
    valLabel: `${count} (${pctStr(total ? count / total : 0)})`,  // overridden per-chart below
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

// ── Consistent color maps (entity → always same color) ───────────

const BRANCH_COLOR = {
  AMNY: '#534AB7', AMLV: '#2367A8', AMDB: '#1E8A8A',
  AMGN: '#3B6D11', AMYS: '#B86B1D', AMBS: '#C45A4A',
  AMJJ: '#8A8A84',
};

const CATEGORY_COLOR = {
  Software:   '#534AB7',
  Hardware:   '#B86B1D',
  Network:    '#2367A8',
  OS:         '#8A8A84',
  소프트웨어: '#534AB7',
  하드웨어:   '#B86B1D',
  네트워크:  '#2367A8',
};

const ACTION_COLOR = {
  'On-Site': '#534AB7',
  'Remote':  '#2367A8',
  Other:     '#8A8A84',
  기타:      '#8A8A84',
};

const DIFF_COLOR = ['#3B6D11', '#1E8A8A', '#B86B1D', '#C45A4A', '#A32D2D'];

// Zone color heuristic — maps zone keywords to semantic colors
function zoneColor(name) {
  if (!name) return '#8A8A84';
  const n = name.toLowerCase();
  if (/cafe|tea/.test(n))       return '#534AB7';
  if (/garden|forest/.test(n))  return '#3B6D11';
  if (/sketch|live/.test(n))    return '#2367A8';
  if (/flower/.test(n))         return '#C45A4A';
  if (/beach|wave|water/.test(n)) return '#1E8A8A';
  if (/entrance/.test(n))       return '#B86B1D';
  if (/sunset|sun/.test(n))     return '#B86B1D';
  return '#8A8A84';
}

// Resolve Time source-system bucket normalization
const RESOLVE_BUCKET_EN = [
  'Under 15 min', 'Under 30 Min', 'Under 1 Hour', 'Under 2 Hour', 'Over 2 Hour',
];
const RESOLVE_BUCKET_KO = [
  '15분 미만', '30분 미만', '1시간 미만', '2시간 미만', '2시간 초과',
];
const RESOLVE_BUCKET_COLOR = ['#3B6D11', '#1E8A8A', '#B86B1D', '#C45A4A', '#A32D2D'];

function normalizeTimeBucket(v) {
  if (v == null) return null;
  const s = String(v).toLowerCase().trim();
  if (!s) return null;
  // Under 15 min
  if (/under\s*15|^15\s*min|15분\s*미만/.test(s)) return 0;
  // Under 30 Min
  if (/under\s*30|^30\s*min|30분\s*미만/.test(s)) return 1;
  // Under 1 Hour (also catches "under 1h", "60 min", "1시간")
  if (/under\s*1\s*(h|hr|hour)|1\s*시간|under\s*60|60\s*min/.test(s)) return 2;
  // Under 2 Hour
  if (/under\s*2\s*(h|hr|hour)|2\s*시간\s*미만/.test(s)) return 3;
  // Over 2 Hour
  if (/over\s*2|2\s*시간\s*초과/.test(s)) return 4;
  // Fallback: try parsing minutes from _minutes if string didn't match
  return null;
}

// ── Visual aggregates builder ─────────────────────────────────────
//
// Computes all chart-ready data arrays from prepared rows.
// All bar widths, percentages, and sort orders are resolved here;
// Handlebars templates remain logic-free.

const EMPTY_CHART_THRESHOLD = 3; // charts with total < 3 are hidden

function buildVisualContext(prepared, opts) {
  const lang = opts.lang === 'ko' ? 'ko' : 'en';
  const variant = opts.variant || 'monthlyBranch';
  const included = prepared.filter(r => !r._excluded);
  const total = included.length;

  // ── Branch distribution ──────────────────────────────────────
  const branchMap = countByKey(included, 'Branch');
  const branchEntries = topNEntries(branchMap, 8);
  const branchSorted = toBarRows(branchEntries, total).map(r => ({
    ...r,
    color: BRANCH_COLOR[r.name] || '#8A8A84',
    segW: Math.round(total ? r.count / total * 100 : 0),
    valLabel: `${formatCount(r.count, 'errors', lang)} (${r.pct})`,
  }));
  const topBranchPct = branchSorted.length && total
    ? pctStr(branchSorted[0].count / total) : '—';
  const branchSummary = branchSorted.length
    ? (lang === 'ko'
        ? `${branchSorted[0].name}가 전체 오류의 ${topBranchPct}를 차지합니다.`
        : `${branchSorted[0].name} accounts for ${topBranchPct} of this period's incidents.`)
    : '';
  const showBranch = total >= EMPTY_CHART_THRESHOLD;

  // ── Zone distribution ────────────────────────────────────────
  const zoneMap = countByKey(included, 'Zone');
  const zoneEntries = topNEntries(zoneMap, 7);
  const zoneSorted = toBarRows(zoneEntries, total).map(r => ({
    ...r,
    color: zoneColor(r.name),
    segW: Math.round(total ? r.count / total * 100 : 0),
    valLabel: `${formatCount(r.count, 'errors', lang)} (${r.pct})`,
  }));
  const topZonePct = zoneSorted.length && total
    ? pctStr(zoneSorted[0].count / total) : '—';
  const zoneSummary = zoneSorted.length
    ? (lang === 'ko'
        ? `${zoneSorted[0].name}가 ${topZonePct}로 최다 발생 Zone입니다.`
        : `${zoneSorted[0].name} is the top affected zone at ${topZonePct}.`)
    : '';
  const showZone = total >= EMPTY_CHART_THRESHOLD;

  // ── Category distribution ────────────────────────────────────
  const catMap = new Map();
  for (const r of included) {
    const v = getCategory(r);
    if (!v) continue;
    catMap.set(v, (catMap.get(v) || 0) + 1);
  }
  const catEntries = topNEntries(catMap, 7);
  const catTotal = catEntries.reduce((s, [, c]) => s + c, 0) || 1;
  const categorySorted = toBarRows(catEntries, total).map(r => ({
    ...r,
    color: CATEGORY_COLOR[r.name] || '#8A8A84',
    segW: Math.round(catTotal ? r.count / catTotal * 100 : 0),
    valLabel: `${formatCount(r.count, 'errors', lang)} (${r.pct})`,
  }));
  // Dominance: top category ≥ 60%
  const catDominant = categorySorted.length && total && categorySorted[0].count / total >= 0.6;
  const catDominantPct = categorySorted.length && total
    ? pctStr(categorySorted[0].count / total) : '—';
  const catSummary = categorySorted.length
    ? (lang === 'ko'
        ? `${categorySorted[0].name}가 ${catDominantPct}로 가장 높은 비중입니다.${catDominant ? ' (지배적)' : ''}`
        : `${categorySorted[0].name} dominates the issue mix at ${catDominantPct}.`)
    : '';
  const showCategory = total >= EMPTY_CHART_THRESHOLD;

  // ── Action type ──────────────────────────────────────────────
  const atRaw = new Map();
  for (const r of included) {
    const at = getActionType(r);
    if (!at) continue;
    const key = /on.?site/i.test(at) ? 'On-Site'
      : /remote/i.test(at) ? 'Remote'
      : (lang === 'ko' ? '기타' : 'Other');
    atRaw.set(key, (atRaw.get(key) || 0) + 1);
  }
  const atEntries = [...atRaw.entries()].sort((a, b) => b[1] - a[1]);
  const atTotal = atEntries.reduce((s, [, c]) => s + c, 0) || 1;
  const actionTypeSorted = toBarRows(atEntries, total).map(r => ({
    ...r,
    color: ACTION_COLOR[r.name] || '#8A8A84',
    segW: Math.round(atTotal ? r.count / atTotal * 100 : 0),
    valLabel: `${formatCount(r.count, 'errors', lang)} (${r.pct})`,
  }));
  // Donut gradient — cumulative conic-gradient string for action type donut
  let _cumPct = 0;
  const donutGradient = actionTypeSorted.length
    ? actionTypeSorted.map((r, idx, arr) => {
        const startPct = _cumPct;
        _cumPct += idx === arr.length - 1
          ? (100 - _cumPct)
          : Math.round(atTotal ? r.count / atTotal * 100 : 0);
        return `${r.color} ${startPct}% ${_cumPct}%`;
      }).join(', ')
    : '#8A8A84 0% 100%';
  const actionTotal = atEntries.reduce((s, [, c]) => s + c, 0);

  const topAtPct = actionTypeSorted.length && total
    ? pctStr(actionTypeSorted[0].count / total) : '—';
  const actionSummary = actionTypeSorted.length
    ? (lang === 'ko'
        ? `대부분의 조치는 ${actionTypeSorted[0].name === 'On-Site' ? '현장' : actionTypeSorted[0].name}에서 처리되었습니다: ${topAtPct}.`
        : `Most actions were handled ${actionTypeSorted[0].name === 'On-Site' ? 'on-site' : actionTypeSorted[0].name.toLowerCase()} at ${topAtPct}.`)
    : '';
  const showActionType = total >= EMPTY_CHART_THRESHOLD;

  // ── Time taken buckets — source-system canonical labels ───────
  const bkt = [0, 0, 0, 0, 0];
  for (const r of included) {
    // Try raw string label first (source system bucket)
    const raw = r['Time Taken'] || r.TimeTaken || r.timeTaken || '';
    const idx = normalizeTimeBucket(raw);
    if (idx !== null) {
      bkt[idx]++;
    } else if (isFinite(r._minutes) && r._minutes > 0) {
      // Fallback: map numeric minutes
      const m = r._minutes;
      if (m <= 15) bkt[0]++;
      else if (m <= 30) bkt[1]++;
      else if (m <= 60) bkt[2]++;
      else if (m <= 120) bkt[3]++;
      else bkt[4]++;
    }
  }
  const bktLabels = lang === 'ko' ? RESOLVE_BUCKET_KO : RESOLVE_BUCKET_EN;
  const bktMax = Math.max(...bkt, 1);
  const bktTotalRecorded = bkt.reduce((s, v) => s + v, 0) || 1;

  const timeTakenBuckets = bktLabels.map((label, i) => ({
    name: label,
    label,
    count: bkt[i],
    pct: pctStr(bktTotalRecorded ? bkt[i] / bktTotalRecorded : 0),
    barW: Math.round(bkt[i] / bktMax * 100),
    valLabel: `${formatCount(bkt[i], 'errors', lang)} (${pctStr(bktTotalRecorded ? bkt[i] / bktTotalRecorded : 0)})`,
    color: RESOLVE_BUCKET_COLOR[i],
    segW: Math.round(bktTotalRecorded ? bkt[i] / bktTotalRecorded * 100 : 0),
  }));

  // Fast rate (Under 15 + Under 30) and Slow rate (Over 2 Hour)
  const fastCount = bkt[0] + bkt[1];
  const slowCount = bkt[4];
  const fastRate = bktTotalRecorded ? fastCount / bktTotalRecorded : 0;
  const slowRate = bktTotalRecorded ? slowCount / bktTotalRecorded : 0;
  const fastRatePct = pctStr(fastRate);
  const slowRatePct = pctStr(slowRate);

  // Median resolve bucket (by cumulative threshold)
  let cumulative = 0;
  let medianBucketLabel = bktLabels[0];
  for (let i = 0; i < 5; i++) {
    cumulative += bkt[i];
    if (cumulative >= bktTotalRecorded / 2) { medianBucketLabel = bktLabels[i]; break; }
  }

  const resolveSummary = bktTotalRecorded > 1
    ? (lang === 'ko'
        ? `전체 오류의 ${fastRatePct}가 30분 이내에 해결되었습니다.${slowCount > 0 ? ` 2시간 초과: ${slowRatePct}.` : ''}`
        : `${fastRatePct} of incidents were resolved within 30 minutes.${slowCount > 0 ? ` Slow (>2hr): ${slowRatePct}.` : ''}`)
    : '';
  const showResolve = bktTotalRecorded >= EMPTY_CHART_THRESHOLD;

  // ── Difficulty distribution ──────────────────────────────────
  const diffCnt = [0, 0, 0, 0, 0];
  for (const r of included) {
    const d = Math.round(getDifficulty(r));
    if (isFinite(d) && d >= 1 && d <= 5) diffCnt[d - 1]++;
  }
  const diffTotal = diffCnt.reduce((s, v) => s + v, 0) || 1;
  const diffMax = Math.max(...diffCnt, 1);
  const difficultyDistribution = diffCnt.map((count, i) => ({
    name: `Lv.${i + 1}`,
    label: `Lv.${i + 1}`,
    count,
    pct: pctStr(diffTotal ? count / diffTotal : 0),
    barW: Math.round(count / diffMax * 100),
    valLabel: `${formatCount(count, 'reports', lang)} (${pctStr(diffTotal ? count / diffTotal : 0)})`,
    color: DIFF_COLOR[i],
    segW: Math.round(diffTotal ? count / diffTotal * 100 : 0),
  }));
  const highDiffCount = diffCnt[3] + diffCnt[4];
  const diffSum = diffCnt.reduce((s, v, i) => s + v * (i + 1), 0);
  const diffCountForAvg = diffCnt.reduce((s, v) => s + v, 0);
  const avgDifficulty = diffCountForAvg > 0 ? Math.round(diffSum / diffCountForAvg * 10) / 10 : null;
  const topDiffIdx = diffCnt.indexOf(Math.max(...diffCnt, 1));
  const diffSummary = avgDifficulty != null
    ? (lang === 'ko'
      ? `평균 난이도 ${avgDifficulty}, 주요 분포 Lv.${topDiffIdx + 1}.`
      : `Average difficulty ${avgDifficulty}; most frequent: Lv.${topDiffIdx + 1}.`)
    : (lang === 'ko' ? '난이도 데이터 없음.' : 'No difficulty data.');
  const showDifficulty = total >= EMPTY_CHART_THRESHOLD;

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
  // Average per active day
  const dailyAvgNum = dayEntries.length ? total / dayEntries.length : 0;
  const avgBarH = Math.round(dailyAvgNum / dayMaxCount * 100);

  const dailyTrend = dayEntries.map(([date, count], idx) => ({
    date,
    dateLabel: date.slice(5).replace('-', '/'),
    count,
    barH: Math.round(count / dayMaxCount * 100),
    isPeak: peakDayEntry && date === peakDayEntry[0],
    isLatest: false,
    isAboveAvg: count > dailyAvgNum,
    showDateLabel: idx === 0 || idx === dayEntries.length - 1 || (idx % 5 === 4),
  }));
  if (dailyTrend.length > 0) dailyTrend[dailyTrend.length - 1].isLatest = true;

  const peakDateLabel = peakDayEntry ? peakDayEntry[0].slice(5).replace('-', '/') : '—';
  const peakCount = peakDayEntry ? peakDayEntry[1] : 0;
  const trendSummary = peakDayEntry
    ? (lang === 'ko'
        ? `${peakDateLabel}에 ${peakCount}건으로 일 평균(${dailyAvgNum.toFixed(1)}건) 대비 최다 발생했습니다.`
        : `Incidents peaked on ${peakDateLabel} with ${formatCount(peakCount, 'errors', lang)}, above the daily average of ${dailyAvgNum.toFixed(1)}.`)
    : '';

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
  const monAvgNum = monEntries.length ? total / monEntries.length : 0;

  const monthlyTrend = monEntries.map(([k, count]) => {
    const mIdx = parseInt(k.slice(5)) - 1;
    return {
      key: k,
      monthLabel: lang === 'ko' ? `${mIdx + 1}월` : MONTHS_EN[mIdx].slice(0, 3),
      count,
      barH: Math.round(count / monMaxCount * 100),
      isPeak: peakMonEntry && k === peakMonEntry[0],
      isLatest: false,
      isAboveAvg: count > monAvgNum,
    };
  });
  if (monthlyTrend.length > 0) monthlyTrend[monthlyTrend.length - 1].isLatest = true;

  const peakMonLabel = peakMonEntry
    ? (() => { const mi = parseInt(peakMonEntry[0].slice(5)) - 1; return lang === 'ko' ? `${mi+1}월` : MONTHS_EN[mi]; })()
    : '—';
  const monthlyTrendSummary = peakMonEntry
    ? (lang === 'ko'
        ? `최다 발생 월은 ${peakMonLabel}, ${peakMonEntry[1]}건입니다.`
        : `Peak month: ${peakMonLabel} with ${peakMonEntry[1]} incidents.`)
    : '';

  // ── Top repeated issues (cluster-based) ─────────────────────
  // Group by Zone + Category; surface representative issue + action
  const SENTINEL = new Set(['-', '--', 'n/a', 'na', 'none', 'tbd', '미정', '없음', '해당없음']);
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

  const clustersSorted = [...clMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  // topRepeatedIssues: cluster-based, includes representative issue + action
  const topRepeatedIssues = clustersSorted.map((e, i) => {
    const iFreq = new Map();
    const aFreq = new Map();
    for (const r of e.rows) {
      const iss = getIssueDetail(r);
      const act = getActionTaken(r);
      if (iss) iFreq.set(iss, (iFreq.get(iss) || 0) + 1);
      if (act && act.length >= 3 && !SENTINEL.has(act.toLowerCase())) {
        aFreq.set(act, (aFreq.get(act) || 0) + 1);
      }
    }
    const topIssue = [...iFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const topAction = [...aFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return {
      rank: i + 1,
      zone: e.zone || '—',
      category: e.cat || '—',
      categoryColor: CATEGORY_COLOR[e.cat] || '#8A8A84',
      count: e.count,
      issue: topIssue,
      actionTaken: topAction,
      share: pctStr(total ? e.count / total : 0),
    };
  });

  // Top-5 share for summary
  const top5Count = clustersSorted.slice(0, 5).reduce((s, e) => s + e.count, 0);
  const top5Share = pctStr(total ? top5Count / total : 0);
  const issueSummary = total > 0
    ? (lang === 'ko'
        ? `상위 반복 이슈 5개가 전체의 ${top5Share}를 차지합니다.`
        : `Top 5 repeated issues account for ${top5Share} of total incidents.`)
    : '';

  // repeatedIssueClusters (for cluster-cards partial — top 5 only)
  const repeatedIssueClusters = clustersSorted.slice(0, 5).map(e => {
    const iFreq = new Map();
    const aFreq = new Map();
    for (const r of e.rows) {
      const iss = getIssueDetail(r);
      const act = getActionTaken(r);
      if (iss) iFreq.set(iss, (iFreq.get(iss) || 0) + 1);
      if (act && act.length >= 3 && !SENTINEL.has(act.toLowerCase())) {
        aFreq.set(act, (aFreq.get(act) || 0) + 1);
      }
    }
    const topIssue = [...iFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const topAction = [...aFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const shareStr = pctStr(total ? e.count / total : 0);
    return {
      title: topIssue,
      count: e.count,
      zone: e.zone || '—',
      category: e.cat || '—',
      categoryColor: CATEGORY_COLOR[e.cat] || '#8A8A84',
      branches: [...e.branches].slice(0, 3).join(', ') || '—',
      monthsAppeared: e.months.size,
      actionTaken: topAction,
      share: shareStr,
      badge: lang === 'ko'
        ? `${e.count}건 · 전체의 ${shareStr}`
        : `${formatCount(e.count, 'cases', lang)} · ${shareStr} of total`,
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
  const topMatrixCell = matMax > 0
    ? (() => {
        let bz = '—', bc = '—';
        for (const { zone, cells } of matRawRows) {
          cells.forEach((c, ci) => { if (c === matMax) { bz = zone; bc = topCatNames[ci]; } });
        }
        return `${bz} × ${bc}`;
      })()
    : '—';
  const matrixSummary = matMax > 0
    ? (lang === 'ko'
        ? `${topMatrixCell} 조합이 가장 많이 발생했습니다.`
        : `${topMatrixCell} is the strongest concentration.`)
    : '';
  const matrixCaption = lang === 'ko' ? '값 = 오류 건수' : 'Values = error count';
  const zoneCategoryMatrix = {
    categories: topCatNames.map(c => ({ name: c, color: CATEGORY_COLOR[c] || '#8A8A84' })),
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
    const bDiffVals = bRows.map(r => Math.round(getDifficulty(r))).filter(d => isFinite(d) && d >= 1 && d <= 5);
    const bAvgDiff = bDiffVals.length > 0
      ? Math.round(bDiffVals.reduce((s, d) => s + d, 0) / bDiffVals.length * 10) / 10
      : null;
    return {
      branch,
      color: BRANCH_COLOR[branch] || '#8A8A84',
      total: count,
      totalLabel: lang === 'ko' ? `${count}건` : formatCount(count, 'errors', lang),
      share: pctStr(total ? count / total : 0),
      topZone: bZone,
      topCategory: bCat,
      avgDifficulty: bAvgDiff != null ? String(bAvgDiff) : '—',
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
  const dailyTrendPeak = lang === 'ko'
    ? `${peakCount}건`
    : formatCount(peakCount, 'errors', lang);
  const dailyTrendLatest = (() => {
    const n = dailyTrend.length ? dailyTrend[dailyTrend.length - 1].count : 0;
    return lang === 'ko' ? `${n}건` : formatCount(n, 'errors', lang);
  })();
  const monthlyTrendFirst = monthlyTrend.length ? monthlyTrend[0].monthLabel : '';
  const monthlyTrendLast = monthlyTrend.length ? monthlyTrend[monthlyTrend.length - 1].monthLabel : '';
  const monthlyTrendPeak = peakMonEntry ? peakMonEntry[1] : 0;
  const monthlyTrendLatest = monthlyTrend.length ? monthlyTrend[monthlyTrend.length - 1].count : 0;

  // ── Insight deduplication (priority order = array order) ────────
  // Earlier entries win; later entries that are identical are nulled.
  const _seenInsights = new Set();
  function _dedup(s) {
    if (!s || typeof s !== 'string') return s || '';
    const k = s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (_seenInsights.has(k)) return '';
    _seenInsights.add(k);
    return s;
  }

  return {
    // Distributions
    branchSorted,
    zoneSorted,
    categorySorted,
    actionTypeSorted,
    donutGradient,
    actionTotal,
    timeTakenBuckets,
    difficultyDistribution,
    avgDifficulty,
    // Segment data (stacked bar / pill)
    catDominant,
    // Trend arrays
    dailyTrend,
    dailyTrendFirst,
    dailyTrendLast,
    dailyTrendPeak,
    dailyTrendLatest,
    avgBarH,
    dailyAvgNum,
    trendMaxCount: dayMaxCount,
    monthlyTrend,
    monthlyTrendFirst,
    monthlyTrendLast,
    monthlyTrendPeak,
    monthlyTrendLatest,
    trendMonthlyMaxCount: monMaxCount,
    // Resolve time analytics
    fastRate,
    slowRate,
    fastRatePct,
    slowRatePct,
    medianBucketLabel,
    // Summary sentences (deduped in priority order)
    branchSummary:       _dedup(branchSummary),
    zoneSummary:         _dedup(zoneSummary),
    catSummary:          _dedup(catSummary),
    actionSummary:       _dedup(actionSummary),
    resolveSummary:      _dedup(resolveSummary),
    diffSummary:         _dedup(diffSummary),
    trendSummary:        _dedup(trendSummary),
    monthlyTrendSummary: _dedup(monthlyTrendSummary),
    issueSummary:        _dedup(issueSummary),
    matrixSummary:       _dedup(matrixSummary),
    // Visibility flags (hide if < threshold)
    showBranch,
    showZone,
    showCategory,
    showActionType,
    showResolve,
    showDifficulty,
    // Evidence tables
    topRepeatedIssues,
    repeatedIssueClusters,
    recentIncidentLog,
    // Matrix + comparison
    zoneCategoryMatrix,
    matrixCaption,
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

  const avgDiff = visual.avgDifficulty;
  const k5 = {
    id: 'K5',
    label: lang === 'ko' ? '평균 난이도' : 'Avg. Difficulty',
    hint: lang === 'ko' ? '보고 기준 평균' : 'Reported avg.',
    value: avgDiff,
    formatted: avgDiff != null ? String(avgDiff) : '—',
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
    colCount:         ko ? '건수'     : 'Errors',
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
    colTotal:         ko ? '오류 건수' : 'Errors',
    colShare:         ko ? '비율'     : 'Share',
    colTopZone:       ko ? '주요 존'   : 'Top Zone',
    colTopCategory:   ko ? '주요 유형' : 'Top Category',
    colAvgDiff:       ko ? '평균 난이도' : 'Avg. Difficulty',
    colMedianResolve: ko ? '중앙 처리' : 'Med.Resolve',
    colDifficulty:    ko ? '난이도'    : 'Difficulty',
    // Comment block
    managerComment:   ko ? '담당자 코멘트' : 'Manager Comment',
    // Zero-data message
    noData: ko
      ? '해당 기간 발생한 오류가 없습니다.'
      : 'No incidents recorded during this period.',
    // Scope fallback
    allBranches: ko ? '전체 지점' : 'All Branches',
    // Trend labels
    peakLabel:   ko ? '최고' : 'Peak',
    latestLabel: ko ? '최근' : 'Latest',
    casesUnit:   ko ? '건수' : 'cases',
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
  const comment   = opts.comment || null;
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

  // Title-block fields (for {{> title-block}} partial)
  const reportTitle = extLabels.reportTypeTitle + (scope ? ` · ${scope}` : '');
  const reportSubtitle = period || generated;

  return Object.assign({}, ctx, visual, {
    kpis: specKpis,
    kpiColumns: '8',
    docTitle,
    generated,
    period,
    scope,
    comment,
    labels,
    reportTitle,
    reportSubtitle,
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
      scope:     lang === 'ko' ? '전체 지점' : 'All Branches',
      generated: fmtDate(now, lang),
      version:   'v2.0',
    },
    kpis: [
      { accent: 'brand', label: lang === 'ko' ? '전체 인시던트' : 'Total Incidents', value: '1,248', hint: lang === 'ko' ? '전년 대비 +8%' : '+8% YoY' },
      { accent: 'crit',  label: lang === 'ko' ? '처리 난이도 높음 (Lv 4+)' : 'High-Difficulty (Lv 4+)', value: '37', hint: lang === 'ko' ? '전년 대비 −12%' : '−12% YoY' },
      { accent: 'ok',    label: lang === 'ko' ? '평균 해결 시간' : 'Avg Resolution', value: '42', unit: lang === 'ko' ? '분' : 'min', hint: lang === 'ko' ? '목표 60분 이내' : 'SLA: <60 min' },
      { accent: 'warn',  label: lang === 'ko' ? '평균 난이도'    : 'Avg Difficulty', value: '2.3', unit: '/5', hint: lang === 'ko' ? '중간 수준' : 'Moderate' },
      { accent: 'brand', label: lang === 'ko' ? '가동률'         : 'Availability', value: '99.82', unit: '%', hint: lang === 'ko' ? '목표 99.5%' : 'Target 99.5%' },
    ],
  };
}

// ── System Monthly Closing Report context ────────────────────────
// Converts raw form JSON (from system-report.html editor) into template context.
function buildSystemMonthlyContext(formState, opts) {
  const lang      = opts.lang      || 'en';
  const scope     = opts.scope     || opts.branch || '';
  const generated = opts.generated || '';
  const ko = lang === 'ko';
  const meta = (formState && formState.meta) || {};
  const period = opts.period || meta.period || '';

  const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const title = opts.title || (scope
    ? scope + ' ' + period + ' System Team Monthly Closing Report'
    : period + ' System Team Monthly Closing Report');

  const labels = {
    reportTypeTitle:   ko ? '시스템 월간 마감 리포트' : 'System Monthly Closing Report',
    systemReportBadge: ko ? 'd\'strict · GTO — 시스템 팀 월간 마감 리포트' : 'd\'strict · GTO — System Team Monthly Closing Report',
    page:              ko ? '페이지' : 'Page',
    metaPeriod:        ko ? '보고 기간' : 'Reporting Period',
    metaAuthor:        ko ? '작성자'   : 'Author',
    metaDate:          ko ? '제출일'   : 'Submission Date',
    metaSite:          ko ? '현장'     : 'Site',
  };

  // Normalize groups — add numbering, strip empty item strings
  const groups = ((formState && formState.groups) || []).map(function(g, gi) {
    return {
      groupNum: gi + 1,
      title: g.title || '',
      blocks: (g.blocks || []).map(function(b, bi) {
        const items = (b.items || [])
          .map(function(s) { return typeof s === 'string' ? s.trim() : ((s && s.text) ? s.text.trim() : ''); })
          .filter(Boolean);
        return { blockNum: (gi + 1) + '.' + (bi + 1), title: b.title || '', items };
      }),
    };
  });

  return {
    lang, title, period, scope, generated,
    meta: { period: meta.period || period, author: meta.author || '', date: meta.date || '', site: meta.site || scope },
    groups,
    labels,
    docTitle: title,
  };
}

module.exports = {
  buildSmokeContext,
  buildMonthlyBranchContext,
  buildMonthlyGlobalContext,
  buildAnnualContext,
  buildSystemMonthlyContext,
  buildV2Context,
  // exposed for scripts
  _helpers: { periodLabel, fmtDate },
};
