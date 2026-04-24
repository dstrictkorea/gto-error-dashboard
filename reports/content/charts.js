'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/content/charts.js
//  Chart data builder — all visual data for the dashboard templates.
//  Pure function, no I/O.
//
//  Exports:
//    buildCharts(prepared, derived, opts) → chartCtx
// ══════════════════════════════════════════════════════════════════

const SENTINEL_ACTION = new Set([
  '-', '--', 'n/a', 'na', 'none', 'tbd', 'tba',
  '미정', '없음', '확인중', '해당없음', '-없음-',
]);

function isActionRecorded(a) {
  if (!a || a.length < 3) return false;
  return !SENTINEL_ACTION.has(a.toLowerCase());
}

function medianOf(nums) {
  if (!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Normalize an array of {name,count} → add share (0-1) + barPct (0-100)
function normalize(arr, total) {
  const max = arr.reduce((m, x) => Math.max(m, x.count), 0) || 1;
  return arr.map(x => ({
    ...x,
    share: total ? x.count / total : 0,
    sharePct: total ? `${(x.count / total * 100).toFixed(1)}%` : '—',
    barPct: Math.round((x.count / max) * 100),
  }));
}

function countByField(rows, field) {
  const m = new Map();
  for (const r of rows) {
    const v = ((r[field] || '')).trim();
    if (!v) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function buildCharts(prepared, derived, opts = {}) {
  const { lang = 'en', priorRows = [] } = opts;
  const included = (prepared || []).filter(r => !r._excluded);
  const total = included.length;

  // ── Branch distribution ─────────────────────────────────────────
  const branchDist = normalize(countByField(included, 'Branch').slice(0, 8), total);

  // ── Zone distribution ───────────────────────────────────────────
  const zoneDist = normalize(countByField(included, 'Zone').slice(0, 8), total);

  // ── Category distribution ───────────────────────────────────────
  const categoryDist = normalize(countByField(included, 'Issue Category').slice(0, 8).length
    ? countByField(included, 'Issue Category').slice(0, 8)
    : countByField(included, 'Category').slice(0, 8), total);

  // ── Daily trend ─────────────────────────────────────────────────
  const dayMap = new Map();
  for (const r of included) {
    if (!r._date) continue;
    const k = r._date.toISOString().slice(0, 10);
    dayMap.set(k, (dayMap.get(k) || 0) + 1);
  }
  const dailyTrend = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, label: date.slice(5), count }));

  // Pre-compute sparkline SVG points (viewBox "0 0 300 80", usable 280×60)
  let sparkPoints = '';
  let sparkDots = [];
  if (dailyTrend.length > 0) {
    const sparkMax = Math.max(...dailyTrend.map(d => d.count), 1);
    const W = 280, H = 60, offX = 10, offY = 10;
    sparkDots = dailyTrend.map((d, i) => {
      const x = offX + Math.round(i / Math.max(dailyTrend.length - 1, 1) * W);
      const y = offY + H - Math.round((d.count / sparkMax) * H);
      return { x, y, count: d.count, label: d.label };
    });
    sparkPoints = sparkDots.map(p => `${p.x},${p.y}`).join(' ');
  }

  // ── Resolve time buckets ────────────────────────────────────────
  const bucketDefs = lang === 'ko' ? [
    { label: '<30분',   min: 0,   max: 30   },
    { label: '30–60분', min: 30,  max: 60   },
    { label: '1–2시간', min: 60,  max: 120  },
    { label: '2–4시간', min: 120, max: 240  },
    { label: '4시간+',  min: 240, max: Infinity },
  ] : [
    { label: '<30 min',  min: 0,   max: 30   },
    { label: '30–60m',   min: 30,  max: 60   },
    { label: '1–2 hr',   min: 60,  max: 120  },
    { label: '2–4 hr',   min: 120, max: 240  },
    { label: '4h+',      min: 240, max: Infinity },
  ];
  const bucketCounts = bucketDefs.map(b => ({ ...b, count: 0 }));
  for (const r of included) {
    if (!isFinite(r._minutes) || r._minutes <= 0) continue;
    for (const b of bucketCounts) {
      if (r._minutes >= b.min && r._minutes < b.max) { b.count++; break; }
    }
  }
  const bucketMax = Math.max(...bucketCounts.map(b => b.count), 1);
  const resolveTimeBuckets = bucketCounts.map(b => ({
    label: b.label,
    count: b.count,
    barPct: Math.round((b.count / bucketMax) * 100),
  }));

  // ── Action type split ───────────────────────────────────────────
  // Group by first 30 chars (lowercase) to catch near-duplicates;
  // "Not recorded" for empty/sentinel.
  const notRecLabel = lang === 'ko' ? '미기재' : 'Not recorded';
  const actionGroupMap = new Map();
  for (const r of included) {
    const a = ((r['Action Taken'] || r.ActionTaken || '')).trim();
    const key = isActionRecorded(a)
      ? a.slice(0, 30).trim().toLowerCase()
      : '__none__';
    if (!actionGroupMap.has(key)) {
      actionGroupMap.set(key, { label: key === '__none__' ? notRecLabel : a.slice(0, 35).trim(), count: 0 });
    }
    actionGroupMap.get(key).count++;
  }
  const actionArr = [...actionGroupMap.values()].sort((a, b) => b.count - a.count);
  const topActionItems = actionArr.slice(0, 4);
  const otherCount = actionArr.slice(4).reduce((s, x) => s + x.count, 0);
  if (otherCount > 0) topActionItems.push({ label: lang === 'ko' ? '기타' : 'Other', count: otherCount });
  const actionMax = Math.max(...topActionItems.map(x => x.count), 1);
  const actionTypeSplit = topActionItems.map(x => ({
    name: x.label,
    count: x.count,
    share: total ? x.count / total : 0,
    sharePct: total ? `${(x.count / total * 100).toFixed(1)}%` : '—',
    barPct: Math.round((x.count / actionMax) * 100),
  }));

  // ── Top repeated issues ─────────────────────────────────────────
  // Group by Category + first 60 chars of Action Taken (lowercase)
  const issueMap = new Map();
  for (const r of included) {
    const cat = ((r['Issue Category'] || r.Category || '')).trim();
    if (!cat) continue;
    const act = ((r['Action Taken'] || r.ActionTaken || '')).trim();
    const key = `${cat}||${act.slice(0, 60).toLowerCase()}`;
    if (!issueMap.has(key)) {
      issueMap.set(key, {
        category: cat,
        representative: act || '—',
        zone: ((r.Zone || '')).trim(),
        count: 0,
      });
    }
    issueMap.get(key).count++;
  }
  const topIssues = [...issueMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(x => ({
      category: x.category,
      count: x.count,
      sharePct: total ? `${Math.round(x.count / total * 100)}%` : '—',
      actionSnippet: x.representative.length > 75
        ? x.representative.slice(0, 75) + '…'
        : x.representative,
    }));

  // ── Zone × Category heatmap ─────────────────────────────────────
  const zones = [...new Set(included.map(r => ((r.Zone || '')).trim()).filter(Boolean))];
  const cats  = [...new Set(included.map(r => ((r['Issue Category'] || r.Category || '')).trim()).filter(Boolean))];
  // Sort zones+cats by total count DESC
  const zoneCount = new Map();
  const catCount  = new Map();
  for (const r of included) {
    const z = ((r.Zone || '')).trim();
    const c = ((r['Issue Category'] || r.Category || '')).trim();
    if (z) zoneCount.set(z, (zoneCount.get(z) || 0) + 1);
    if (c) catCount.set(c,  (catCount.get(c)  || 0) + 1);
  }
  const sortedZones = zones.sort((a, b) => (zoneCount.get(b) || 0) - (zoneCount.get(a) || 0)).slice(0, 7);
  const sortedCats  = cats.sort((a, b) => (catCount.get(b)  || 0) - (catCount.get(a)  || 0)).slice(0, 6);

  const heatCells = {};
  for (const r of included) {
    const z = ((r.Zone || '')).trim();
    const c = ((r['Issue Category'] || r.Category || '')).trim();
    if (!z || !c) continue;
    const k = `${z}||${c}`;
    heatCells[k] = (heatCells[k] || 0) + 1;
  }
  const heatMax = Math.max(...Object.values(heatCells), 1);
  const heatRows = sortedZones.map(z => ({
    zone: z,
    cells: sortedCats.map(c => {
      const v = heatCells[`${z}||${c}`] || 0;
      return {
        value: v || '',
        intensity: Math.round((v / heatMax) * 100),
        isEmpty: v === 0,
      };
    }),
  }));

  // ── Branch comparison table ─────────────────────────────────────
  const branches = [...new Set(included.map(r => ((r.Branch || '')).trim()).filter(Boolean))];
  const branchCompTable = branches.map(br => {
    const rows = included.filter(r => ((r.Branch || '')).trim() === br);
    const hd = rows.filter(r => {
      const d = Number(r['Issue Difficulty'] || r.Difficulty || 0);
      return isFinite(d) && d >= 4;
    }).length;
    const mins = rows.filter(r => isFinite(r._minutes) && r._minutes > 0).map(r => r._minutes);
    const med = medianOf(mins);
    const catM = new Map();
    for (const r of rows) {
      const c = ((r['Issue Category'] || r.Category || '')).trim();
      if (c) catM.set(c, (catM.get(c) || 0) + 1);
    }
    const topCat = [...catM.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return {
      branch: br,
      total: rows.length,
      highDiff: hd,
      highDiffPct: rows.length ? `${Math.round(hd / rows.length * 100)}%` : '—',
      medianResolve: med != null ? `${Math.round(med)} min` : '—',
      topCategory: topCat,
    };
  }).sort((a, b) => b.total - a.total).slice(0, 10);

  // ── Issue clusters (Top 3 detailed) ────────────────────────────
  const issueClusters = topIssues.slice(0, 3).map((issue, i) => {
    const sameCategory = included.filter(r => ((r['Issue Category'] || r.Category || '')).trim() === issue.category);
    const zones3 = [...new Set(sameCategory.map(r => ((r.Zone || '')).trim()).filter(Boolean))].slice(0, 3).join(', ') || '—';
    return {
      rank: i + 1,
      category: issue.category,
      count: issue.count,
      sharePct: issue.sharePct,
      actionFull: sameCategory[0]
        ? ((sameCategory[0]['Action Taken'] || sameCategory[0].ActionTaken || '')).trim().slice(0, 200) || '—'
        : '—',
      zones: zones3,
    };
  });

  // ── Recent incident log (newest 12) ────────────────────────────
  const recentLog = [...included]
    .filter(r => r._date)
    .sort((a, b) => b._date - a._date)
    .slice(0, 12)
    .map(r => ({
      date: r._date.toISOString().slice(0, 10),
      zone: (r.Zone || '').trim() || '—',
      branch: (r.Branch || '').trim() || '—',
      category: (r['Issue Category'] || r.Category || '').trim() || '—',
      actionType: (r['Action Type'] || '').trim() || '—',
      timeTaken: (isFinite(r._minutes) && r._minutes > 0) ? `${Math.round(r._minutes)} min` : '—',
      difficulty: isFinite(Number(r['Issue Difficulty'] || r.Difficulty)) ? String(Math.round(Number(r['Issue Difficulty'] || r.Difficulty))) : '—',
      difficultyHigh: isFinite(Number(r['Issue Difficulty'] || r.Difficulty)) && Number(r['Issue Difficulty'] || r.Difficulty) >= 4,
      solvedBy: (r['Solved By'] || '').trim() || '—',
      actionSnippet: (r['Action Taken'] || r.ActionTaken || '').trim().slice(0, 55) || '—',
    }));

  // ── Calendar KPIs ───────────────────────────────────────────────
  const dates = included.filter(r => r._date).map(r => r._date);
  let calendarDays = 0, activeDays = 0;
  if (dates.length) {
    const minD = dates.reduce((m, d) => d < m ? d : m);
    const maxD = dates.reduce((m, d) => d > m ? d : m);
    calendarDays = Math.round((maxD - minD) / 86400000) + 1;
    activeDays   = new Set(dates.map(d => d.toISOString().slice(0, 10))).size;
  }
  const dailyAvg     = calendarDays > 0 ? (total / calendarDays).toFixed(1) : null;
  const activeDayAvg = activeDays   > 0 ? (total / activeDays).toFixed(1)   : null;

  // ── MoM delta ──────────────────────────────────────────────────
  const priorIncluded = (Array.isArray(priorRows) ? priorRows : []).filter(r => !r._excluded);
  const priorTotal    = priorIncluded.length;
  let momDelta = null, momDeltaPct = null, momPartialBaseline = false, momSign = '';
  if (priorTotal > 0) {
    momDelta    = total - priorTotal;
    momDeltaPct = (momDelta / priorTotal * 100).toFixed(1);
    momSign     = momDelta >= 0 ? '+' : '';
    const priorDays = new Set(
      priorIncluded.filter(r => r._date).map(r => r._date.toISOString().slice(0, 10))
    ).size;
    momPartialBaseline = priorDays < 14;
  }
  const momLabel = momDelta == null
    ? null
    : `${momSign}${momDeltaPct}%${momPartialBaseline ? (lang === 'ko' ? ' (부분 기준)' : ' (partial baseline)') : ''}`;

  // ── Dashboard KPIs (spec: 7 items) ─────────────────────────────
  function fmtOrDash(v) { return (v == null || !isFinite(Number(v))) ? '—' : String(v); }

  const topZoneName = zoneDist.length ? zoneDist[0].name : null;
  const topZoneShare = zoneDist.length ? zoneDist[0].sharePct : '—';
  const topCatName = categoryDist.length ? categoryDist[0].name : null;
  const topCatShare = categoryDist.length ? categoryDist[0].sharePct : '—';

  // DK4: High-Difficulty — use Issue Difficulty field
  const highDiffCount = included.filter(r => {
    const d = Number(r['Issue Difficulty'] || r.Difficulty || 0);
    return isFinite(d) && d >= 4;
  }).length;
  const highDiffShare = total > 0 ? `${(highDiffCount / total * 100).toFixed(1)}%` : '—';

  const medianResolve = (derived && derived.medianResolveMin != null)
    ? `${Math.round(derived.medianResolveMin)} min` : '—';

  const dashboardKpis = [
    {
      id: 'DK1',
      label:   lang === 'ko' ? '총 건수'         : 'Total Incidents',
      value:   total.toLocaleString('en-US'),
      sub:     momLabel || '',
      accent:  'brand',
    },
    {
      id: 'DK2',
      label:   lang === 'ko' ? '일평균 (달력)'   : 'Daily Avg',
      value:   fmtOrDash(dailyAvg),
      sub:     calendarDays ? `${calendarDays}${lang === 'ko' ? '일 기준' : ' cal days'}` : '',
      accent:  'neutral',
    },
    {
      id: 'DK3',
      label:   lang === 'ko' ? '운영일 평균'     : 'Active-Day Avg',
      value:   fmtOrDash(activeDayAvg),
      sub:     activeDays ? `${activeDays}${lang === 'ko' ? '일 운영' : ' active days'}` : '',
      accent:  'neutral',
    },
    {
      id: 'DK4',
      label:   lang === 'ko' ? '고난도 (4+)'     : 'High-Difficulty',
      value:   highDiffCount.toLocaleString('en-US'),
      sub:     highDiffShare,
      accent:  highDiffCount > 0 ? 'warn' : 'neutral',
    },
    {
      id: 'DK5',
      label:   lang === 'ko' ? '처리 중앙값'     : 'Median Resolve',
      value:   medianResolve,
      sub:     '',
      accent:  'neutral',
    },
    {
      id: 'DK6',
      label:   lang === 'ko' ? '최다 구역'       : 'Top Zone',
      value:   zoneDist[0] ? zoneDist[0].name : '—',
      sub:     zoneDist[0] ? zoneDist[0].sharePct : '',
      accent:  'neutral',
    },
    {
      id: 'DK7',
      label:   lang === 'ko' ? '최다 카테고리'   : 'Top Category',
      value:   categoryDist[0] ? categoryDist[0].name : '—',
      sub:     categoryDist[0] ? categoryDist[0].sharePct : '',
      accent:  'neutral',
    },
  ];

  // ── NEW: Action Type distribution ───────────────────────────────
  const actionTypeDist = normalize(countByField(included, 'Action Type').slice(0, 6), total);

  // ── NEW: Solved By distribution (top 6, with avg time) ─────────
  function buildSolvedByDist(rows) {
    const m = new Map();
    for (const r of rows) {
      const who = (r['Solved By'] || '').trim();
      if (!who) continue;
      if (!m.has(who)) m.set(who, { name: who, count: 0, minutes: [] });
      const item = m.get(who);
      item.count++;
      if (isFinite(r._minutes) && r._minutes > 0) item.minutes.push(r._minutes);
    }
    const arr = [...m.values()].sort((a, b) => b.count - a.count).slice(0, 6);
    const maxCount = arr.reduce((m, x) => Math.max(m, x.count), 0) || 1;
    return arr.map(x => ({
      name: x.name,
      count: x.count,
      avgTime: x.minutes.length ? Math.round(x.minutes.reduce((a, b) => a + b, 0) / x.minutes.length) : null,
      avgTimeStr: x.minutes.length ? `${Math.round(x.minutes.reduce((a, b) => a + b, 0) / x.minutes.length)} min` : '—',
      barPct: Math.round((x.count / maxCount) * 100),
    }));
  }
  const solvedByDist = buildSolvedByDist(included);

  // ── NEW: Difficulty bands ───────────────────────────────────────
  function buildDifficultyBands(rows) {
    const bands = [
      { label: 'Normal',   labelKo: '정상',   min: 1, max: 2, count: 0, minutes: [] },
      { label: 'Moderate', labelKo: '보통',   min: 3, max: 3, count: 0, minutes: [] },
      { label: 'High',     labelKo: '고난도', min: 4, max: 5, count: 0, minutes: [] },
    ];
    for (const r of rows) {
      const d = Number(r['Issue Difficulty'] || r.Difficulty || 0);
      if (!isFinite(d)) continue;
      for (const b of bands) {
        if (d >= b.min && d <= b.max) {
          b.count++;
          if (isFinite(r._minutes) && r._minutes > 0) b.minutes.push(r._minutes);
          break;
        }
      }
    }
    const t = rows.length || 1;
    return bands.map(b => ({
      label: b.label,
      labelKo: b.labelKo,
      count: b.count,
      sharePct: `${(b.count / t * 100).toFixed(1)}%`,
      avgTime: b.minutes.length ? `${Math.round(b.minutes.reduce((a, v) => a + v, 0) / b.minutes.length)} min` : '—',
    }));
  }
  const difficultyBands = buildDifficultyBands(included);

  // ── NEW: Weekday distribution ───────────────────────────────────
  function buildWeekdayDist(rows, lang) {
    const labels = lang === 'ko'
      ? ['일', '월', '화', '수', '목', '금', '토']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    for (const r of rows) {
      if (!r._date) continue;
      counts[r._date.getDay()]++;
    }
    const max = Math.max(...counts, 1);
    return labels.map((lbl, i) => ({
      label: lbl,
      count: counts[i],
      barPct: Math.round((counts[i] / max) * 100),
    }));
  }
  const weekdayDist = buildWeekdayDist(included, lang);

  // ── NEW: Dual trend (total + highDiff per day) → pre-computed SVG
  function buildDualTrendSvg(dailyTrend, includedRows) {
    // Build highDiff per day
    const hdByDay = new Map();
    for (const r of includedRows) {
      if (!r._date) continue;
      const d = Number(r['Issue Difficulty'] || r.Difficulty || 0);
      if (!isFinite(d) || d < 4) continue;
      const k = r._date.toISOString().slice(0, 10);
      hdByDay.set(k, (hdByDay.get(k) || 0) + 1);
    }
    const dualData = dailyTrend.map(d => ({
      ...d,
      hd: hdByDay.get(d.date) || 0,
    }));

    if (dualData.length === 0) return { svg: '', dualData: [] };

    // SVG dimensions: viewBox 0 0 320 90
    const W = 300, H = 80, offX = 10, offY = 5;
    const n = dualData.length;
    const maxTotal = Math.max(...dualData.map(d => d.count), 1);
    const maxHd = Math.max(...dualData.map(d => d.hd), 1);
    const barW = Math.max(2, Math.floor(W / n) - 1);

    // Bars (total)
    const bars = dualData.map((d, i) => {
      const x = offX + i * (W / n);
      const bh = Math.round((d.count / maxTotal) * H);
      return `<rect x="${x.toFixed(1)}" y="${(offY + H - bh).toFixed(1)}" width="${barW}" height="${bh}" fill="#3B6D11" opacity="0.7"/>`;
    }).join('');

    // Line (highDiff)
    const pts = dualData.map((d, i) => {
      const x = offX + i * (W / n) + barW / 2;
      const y = offY + H - Math.round((d.hd / maxHd) * H);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const line = `<polyline points="${pts}" fill="none" stroke="#A32D2D" stroke-width="1.5" stroke-linejoin="round"/>`;
    const dots = dualData.map((d, i) => {
      const x = offX + i * (W / n) + barW / 2;
      const y = offY + H - Math.round((d.hd / maxHd) * H);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#A32D2D"/>`;
    }).join('');

    const svg = `<svg viewBox="0 0 320 90" class="dual-trend-svg">${bars}${line}${dots}</svg>`;
    return { svg, dualData, maxTotal, maxHd };
  }
  const dualTrend = buildDualTrendSvg(dailyTrend, included);

  // ── NEW: Donut chart SVG (category distribution) ────────────────
  function buildDonutSvg(data, total) {
    if (!data.length || !total) return { svg: '', slices: [] };
    const COLORS = ['#534AB7', '#185FA5', '#3B6D11', '#A32D2D', '#854F0B', '#0F6E56', '#993C1D'];
    const R = 36, IR = 20, CX = 45, CY = 45;
    let angle = -Math.PI / 2;
    const slices = data.slice(0, 6).map((item, i) => {
      const slice = (item.count / total) * 2 * Math.PI;
      const end = angle + slice;
      const x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
      const x2 = CX + R * Math.cos(end),   y2 = CY + R * Math.sin(end);
      const ix1 = CX + IR * Math.cos(angle), iy1 = CY + IR * Math.sin(angle);
      const ix2 = CX + IR * Math.cos(end),   iy2 = CY + IR * Math.sin(end);
      const large = slice > Math.PI ? 1 : 0;
      const path = [
        `M${ix1.toFixed(1)},${iy1.toFixed(1)}`,
        `L${x1.toFixed(1)},${y1.toFixed(1)}`,
        `A${R},${R},0,${large},1,${x2.toFixed(1)},${y2.toFixed(1)}`,
        `L${ix2.toFixed(1)},${iy2.toFixed(1)}`,
        `A${IR},${IR},0,${large},0,${ix1.toFixed(1)},${iy1.toFixed(1)}Z`,
      ].join('');
      angle = end;
      return { ...item, path, color: COLORS[i % COLORS.length] };
    });
    const paths = slices.map(s => `<path d="${s.path}" fill="${s.color}"/>`).join('');
    const svg = `<svg viewBox="0 0 90 90" class="donut-svg">${paths}<text x="${CX}" y="${CY + 4}" text-anchor="middle" font-size="8" font-weight="700" fill="#1a1a18">${total.toLocaleString('en-US')}</text></svg>`;
    return { svg, slices };
  }
  const donut = buildDonutSvg(categoryDist, total);

  // ── NEW: Top issue detail (top category + 7-day mini sparkline) ─
  function buildTopIssueDetail(categoryDist, included) {
    if (!categoryDist.length) return null;
    const topCat = categoryDist[0].name;
    const catRows = included.filter(r => (r['Issue Category'] || r.Category || '').trim() === topCat);

    // 7-day mini trend (last 7 active days)
    const dayMap7 = new Map();
    for (const r of catRows) {
      if (!r._date) continue;
      const k = r._date.toISOString().slice(0, 10);
      dayMap7.set(k, (dayMap7.get(k) || 0) + 1);
    }
    const trend7 = [...dayMap7.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7);
    const max7 = Math.max(...trend7.map(d => d[1]), 1);
    const spark7 = trend7.length > 1
      ? trend7.map(([, v], i) => {
          const x = 5 + i * (70 / Math.max(trend7.length - 1, 1));
          const y = 35 - Math.round((v / max7) * 30);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ')
      : '';
    const miniSvg = spark7
      ? `<svg viewBox="0 0 80 40" class="mini-spark"><polyline points="${spark7}" fill="none" stroke="#534AB7" stroke-width="1.5"/></svg>`
      : '';

    // Avg time for top cat
    const catMins = catRows.filter(r => isFinite(r._minutes) && r._minutes > 0).map(r => r._minutes);
    const avgTime = catMins.length ? Math.round(catMins.reduce((a, b) => a + b, 0) / catMins.length) : null;
    const hdCount = catRows.filter(r => {
      const d = Number(r['Issue Difficulty'] || r.Difficulty || 0);
      return isFinite(d) && d >= 4;
    }).length;

    // Top zone for this category
    const zoneM = new Map();
    for (const r of catRows) { const z = (r.Zone || '').trim(); if (z) zoneM.set(z, (zoneM.get(z) || 0) + 1); }
    const topZone = [...zoneM.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    return {
      category: topCat,
      count: catRows.length,
      sharePct: total ? `${(catRows.length / total * 100).toFixed(1)}%` : '—',
      avgTime: avgTime ? `${avgTime} min` : '—',
      hdCount,
      topZone,
      miniSvg,
    };
  }
  const topIssueDetail = buildTopIssueDetail(categoryDist, included);

  // ── NEW: Statistical context (is this month normal?) ────────────
  function buildStatContext(total, priorIncluded, lang) {
    if (!priorIncluded || priorIncluded.length === 0) return null;
    const priorTotal = priorIncluded.length;
    const delta = total - priorTotal;
    const deltaPct = ((delta / priorTotal) * 100).toFixed(1);
    const sign = delta >= 0 ? '+' : '';
    // Simple z-score proxy: if delta > 20% → above normal, < -20% → below normal
    let status = 'normal';
    if (Math.abs(delta / priorTotal) > 0.2) status = delta > 0 ? 'above' : 'below';
    return {
      status, // 'normal' | 'above' | 'below'
      deltaStr: `${sign}${deltaPct}%`,
      deltaN: delta,
      priorTotal,
      label: lang === 'ko'
        ? (status === 'normal' ? '정상 범위' : status === 'above' ? '평균 초과 ▲' : '평균 이하 ▼')
        : (status === 'normal' ? 'Normal range' : status === 'above' ? 'Above avg ▲' : 'Below avg ▼'),
    };
  }
  const statContext = buildStatContext(total, priorIncluded.filter ? priorIncluded.filter(r => !r._excluded) : [], lang);

  return {
    // Chart arrays
    branchDist,
    zoneDist,
    categoryDist,
    dailyTrend,
    sparkPoints,
    sparkDots,
    resolveTimeBuckets,
    actionTypeSplit,
    topIssues,
    // Page 2
    heatRows,
    heatCategories: sortedCats,
    branchCompTable,
    issueClusters,
    recentLog,
    // KPI
    dashboardKpis,
    // Stats
    calendarDays,
    activeDays,
    dailyAvg,
    activeDayAvg,
    // MoM
    priorTotal,
    momDelta,
    momDeltaPct,
    momLabel,
    momPartialBaseline,
    // Zero-data flag
    isEmpty: total === 0,
    // NEW computations
    actionTypeDist,
    solvedByDist,
    difficultyBands,
    weekdayDist,
    dualTrend,      // { svg, dualData, maxTotal, maxHd }
    donut,          // { svg, slices }
    topIssueDetail,
    statContext,
  };
}

module.exports = { buildCharts };
