'use strict';

// Content pipeline smoke test.
// Run: node reports/content/__smoke__.js

const { buildReportContext } = require('./index');

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
}

function printCard(r) {
  const tag = r.type === 'recommendation'
    ? `[${r.strength || '?'}]`
    : `[${r.type === 'combinedObservation' ? 'combined' : 'obs'}]`;
  console.log(`  ${tag.padEnd(10)} ${r.id} — ${r.title}`);
  if (r.observed && !r.observed.includes('\n')) {
    console.log(`     observed: ${r.observed.slice(0, 100)}${r.observed.length > 100 ? '…' : ''}`);
  } else if (r.observed) {
    r.observed.split('\n').forEach(l => console.log(`     ${l}`));
  }
  if (r.action)   console.log(`     action  : ${r.action.slice(0, 100)}${r.action.length > 100 ? '…' : ''}`);
  if (r.note)     console.log(`     note    : ${r.note.slice(0, 100)}${r.note.length > 100 ? '…' : ''}`);
  const c = r.confidence;
  if (c) console.log(`     conf    : score=${c.score.toFixed(2)} path=${c.passPath || '—'} failing=${(c.failing || []).join(',') || 'none'}`);
}

function mkRow(i, overrides) {
  return Object.assign({
    Branch: 'AMGN',
    Zone: i % 3 === 0 ? 'Hall A' : (i % 3 === 1 ? 'Hall B' : 'Lobby'),
    Date: new Date(2026, 2, 1 + (i % 27)).toISOString().slice(0, 10),
    Time: `${9 + (i % 10)}:${((i * 7) % 60).toString().padStart(2, '0')}`,
    TimeTaken: `${30 + (i % 90)}`,
    Category: i % 4 === 0 ? 'Sensor' : (i % 4 === 1 ? 'Network' : (i % 4 === 2 ? 'Mechanical' : 'Power')),
    ActionTaken: i % 10 === 0 ? '' : 'Replaced module and verified operation.',
    Difficulty: (i % 7 === 0) ? 4 : 2,
  }, overrides || {});
}

// ══════════════════════════════════════════════════════════════════
//  1. Branch, no severity data, marginal difficulty (T14 should NOT fire
//     — tighter AND gate requires all three conditions simultaneously)
// ══════════════════════════════════════════════════════════════════

const rows = Array.from({ length: 120 }, (_, i) => mkRow(i));
const ctxBranch = buildReportContext(rows, {
  lang: 'en', variant: 'monthlyBranch', period: 'March 2026', scope: 'AMGN',
});

console.log('\n── 1. Branch EN (marginal difficulty — T14 must NOT fire) ──');
console.log('K2    :', ctxBranch.kpis.find(k => k.id === 'K2').label, '/', ctxBranch.kpis.find(k => k.id === 'K2').semantic);
console.log('S2    :', ctxBranch.anomalyKey, '→', ctxBranch.narrative.s2);
console.log('recs  :'); ctxBranch.recommendations.forEach(printCard);
console.log('obs   :'); ctxBranch.observations.forEach(printCard);
console.log('valid :', ctxBranch._validation);

assert(ctxBranch._validation.ok, `branch: ${JSON.stringify(ctxBranch._validation.errors)}`);
assert(!ctxBranch.recommendations.some(r => r.id === 'T09'), 'T09 must not fire without severity');
assert(!ctxBranch.observations.some(o => o.id === 'T14'), 'T14 must not fire — AND gate should suppress it');
assert(ctxBranch.kpis.find(k => k.id === 'K2').semantic === 'reported_difficulty', 'K2 must be reported_difficulty');
// Tighter T14 means S2 falls to balanced (no friction triggers)
assert(ctxBranch.anomalyKey === 's2.balanced', `expected s2.balanced, got ${ctxBranch.anomalyKey}`);

// ══════════════════════════════════════════════════════════════════
//  2. Global, severity present — T09 may fire (strict or dualPath)
// ══════════════════════════════════════════════════════════════════

const globalRows = Array.from({ length: 240 }, (_, i) => {
  const r = mkRow(i, { Zone: i < 120 ? (i % 3 === 0 ? 'Hall A' : 'Hall B') : 'Zone X' });
  if (i % 6 === 0) r.Severity = 'Critical';
  return r;
});

const ctxGlobal = buildReportContext(globalRows, {
  lang: 'en', variant: 'monthlyGlobal', period: 'March 2026', scope: 'Global',
});

console.log('\n── 2. Global EN (severity present) ──');
console.log('K2 :', ctxGlobal.kpis.find(k => k.id === 'K2').formatted, '/', ctxGlobal.kpis.find(k => k.id === 'K2').semantic);
console.log('S2 :', ctxGlobal.anomalyKey, '→', ctxGlobal.narrative.s2);
ctxGlobal.recommendations.forEach(printCard);
ctxGlobal.observations.forEach(printCard);
console.log('valid:', ctxGlobal._validation);

assert(ctxGlobal._validation.ok, `global: ${JSON.stringify(ctxGlobal._validation.errors)}`);
assert(ctxGlobal.kpis.find(k => k.id === 'K2').semantic === 'severity_critical', 'K2 must be severity_critical');
// All recommendations must have strength field
ctxGlobal.recommendations.forEach(r =>
  assert(['strict','soft'].includes(r.strength), `rec ${r.id} missing valid strength`));

// ══════════════════════════════════════════════════════════════════
//  3. Single-day spike — suppressed to observation, not recommendation
// ══════════════════════════════════════════════════════════════════

const spikeRows = Array.from({ length: 40 }, (_, i) => mkRow(i, {
  Date: '2026-03-15', Category: 'Sensor', Zone: 'Hall A', TimeTaken: '45',
}));

const ctxSpike = buildReportContext(spikeRows, {
  lang: 'en', variant: 'monthlyBranch', period: 'March 2026', scope: 'AMGN',
});

console.log('\n── 3. Single-day spike (must suppress pattern recs) ──');
ctxSpike.recommendations.forEach(printCard);
ctxSpike.observations.forEach(printCard);
console.log('valid:', ctxSpike._validation);

assert(ctxSpike._validation.ok, `spike: ${JSON.stringify(ctxSpike._validation.errors)}`);
const suppressedFacts = ctxSpike.recommendations.filter(r => ['T02','T03','T04','T05','T10'].includes(r.id));
assert(suppressedFacts.length === 0, `spike: pattern recs must be suppressed, got ${suppressedFacts.map(r=>r.id)}`);
assert(ctxSpike.observations.some(o =>
  o.id === 'T02' || o.id === 'T04' || (o.type === 'combinedObservation' && (o.sources||[]).includes('T02'))),
  'spike: T02/T04 should surface as observation or be combined');

// ══════════════════════════════════════════════════════════════════
//  4. Dual-path pass — Sensor at 38% of 200 rows, 5 days, 3 zones.
//     T02 category dominance fires: margin over 35% threshold is only
//     8.6% relative (below the 20% min) → strict fails.
//     Sample (76), temporal (5 days), noise all ≥ 0.95 → dualPath passes.
//     T04 (hotspot) does NOT fire — no single zone×category ≥ 15%.
//     Recommendation T02 emitted with strength='soft' + softAction copy.
// ══════════════════════════════════════════════════════════════════

const days5 = ['2026-03-01','2026-03-02','2026-03-03','2026-03-04','2026-03-05'];
const dualRows = [];
for (let i = 0; i < 200; i++) {
  dualRows.push({
    Branch: 'AMGN',
    Zone: i % 3 === 0 ? 'Hall A' : (i % 3 === 1 ? 'Hall B' : 'Lobby'),
    Date: days5[i % 5], Time: '10:00', TimeTaken: '45',
    Category: i < 76 ? 'Sensor' : (i < 126 ? 'Network' : (i < 166 ? 'Mechanical' : 'Power')),
    ActionTaken: 'Replaced unit and confirmed resolution.',
    Difficulty: 2,
  });
}

const ctxDual = buildReportContext(dualRows, {
  lang: 'en', variant: 'monthlyBranch', period: 'March 2026', scope: 'AMGN',
});

console.log('\n── 4. Dual-path (Sensor 38%, 5 days → soft recommendation) ──');
ctxDual.recommendations.forEach(printCard);
ctxDual.observations.forEach(printCard);
console.log('valid:', ctxDual._validation);

assert(ctxDual._validation.ok, `dual: ${JSON.stringify(ctxDual._validation.errors)}`);
const softRecs = ctxDual.recommendations.filter(r => r.strength === 'soft');
const strictRecs = ctxDual.recommendations.filter(r => r.strength === 'strict');
console.log(`  soft recs: ${softRecs.length}, strict recs: ${strictRecs.length}`);
assert(softRecs.length > 0, 'dualPath: expected at least one soft recommendation');
// Soft recs must use hedged language (contain "Consider")
softRecs.forEach(r => assert(r.action && r.action.includes('Consider'),
  `soft rec ${r.id} action should contain "Consider", got: "${r.action}"`));

// ══════════════════════════════════════════════════════════════════
//  5. T14 Friction Signal — requires ALL three conditions (AND gate).
//     200 rows, 33% high-difficulty, 95 min median, 20 distinct days.
// ══════════════════════════════════════════════════════════════════

const frictionRows = Array.from({ length: 200 }, (_, i) => mkRow(i, {
  Date: new Date(2026, 2, 1 + (i % 20)).toISOString().slice(0, 10),
  Difficulty: (i % 3 === 0) ? 4 : 2,
  TimeTaken: '95',
}));

const ctxFriction = buildReportContext(frictionRows, {
  lang: 'en', variant: 'monthlyBranch', period: 'March 2026', scope: 'AMGN',
});

console.log('\n── 5. Friction signal (all three AND conditions met) ──');
console.log('S2:', ctxFriction.anomalyKey, '→', ctxFriction.narrative.s2);
ctxFriction.recommendations.forEach(printCard);
ctxFriction.observations.forEach(printCard);
console.log('valid:', ctxFriction._validation);

assert(ctxFriction._validation.ok, `friction: ${JSON.stringify(ctxFriction._validation.errors)}`);
assert(ctxFriction.anomalyKey === 's2.frictionSignal', `expected frictionSignal, got ${ctxFriction.anomalyKey}`);
const t14obs = ctxFriction.observations.filter(o => o.id === 'T14' || (o.type === 'combinedObservation' && (o.sources||[]).includes('T14')));
assert(t14obs.length > 0, 'T14 must appear in observations');
assert(!ctxFriction.recommendations.some(r => r.id === 'T14'), 'T14 must never be a recommendation');
assert(!ctxFriction.recommendations.some(r => r.id === 'T09'), 'T09 must not fire without severity');

// ══════════════════════════════════════════════════════════════════
//  6. Observation density control — generate >3 observations and
//     verify Combined Insight Block is produced.
// ══════════════════════════════════════════════════════════════════

// Global dataset: critical spike + zone concentration + category + slow resolve
// All spread across just 2 days to fail confidence gates → all become observations.
const denseRows = Array.from({ length: 60 }, (_, i) => ({
  Branch: 'AMGN',
  Zone: i < 35 ? 'Hall A' : 'Hall B',
  Date: i % 2 === 0 ? '2026-03-01' : '2026-03-02',   // only 2 distinct days
  Time: '10:00',
  TimeTaken: `${100 + (i % 50)}`,                      // slow resolve
  Category: i < 30 ? 'Sensor' : (i < 45 ? 'Network' : (i < 55 ? 'Power' : 'Mechanical')),
  ActionTaken: i % 5 === 0 ? '' : 'Fixed.',
  Difficulty: i % 3 === 0 ? 4 : 2,
  Severity: i % 4 === 0 ? 'Critical' : undefined,
}));

const ctxDense = buildReportContext(denseRows, {
  lang: 'en', variant: 'monthlyGlobal', period: 'March 2026', scope: 'AMGN',
});

console.log('\n── 6. Observation density control (>3 obs → Combined Block) ──');
console.log('total obs (final, after combine):', ctxDense._diagnostics.recommendations.obsFinal);
ctxDense.recommendations.forEach(printCard);
ctxDense.observations.forEach(printCard);
console.log(`obs count after combine: ${ctxDense.observations.length}`);
console.log('valid:', ctxDense._validation);

assert(ctxDense._validation.ok, `dense: ${JSON.stringify(ctxDense._validation.errors)}`);
assert(ctxDense.observations.length <= 3, `obs count ${ctxDense.observations.length} exceeds density cap`);

// ══════════════════════════════════════════════════════════════════
//  7. Low-confidence data — T12 strict recommendation
// ══════════════════════════════════════════════════════════════════

const badRows = rows.concat(Array.from({ length: 40 }, (_, i) => mkRow(i, { Date: '' })));
const ctxLow = buildReportContext(badRows, {
  lang: 'en', variant: 'monthlyBranch', period: 'March 2026', scope: 'AMGN',
});

console.log('\n── 7. Low-confidence data ──');
console.log('confidence:', ctxLow.confidence.level, `(${ctxLow.confidence.excludedPct}% excluded)`);
console.log('legend    :', ctxLow.confidenceLegend);
ctxLow.recommendations.forEach(printCard);
ctxLow.observations.forEach(printCard);
console.log('valid:', ctxLow._validation);

assert(ctxLow._validation.ok, `lowConf: ${JSON.stringify(ctxLow._validation.errors)}`);
assert(ctxLow.confidence.level === 'low', 'expected low confidence');
assert(ctxLow.recommendations.some(r => r.id === 'T12'), 'T12 should fire as recommendation');
const t12 = ctxLow.recommendations.find(r => r.id === 'T12');
assert(t12.strength === 'strict', 'T12 must be strict (always-pass)');

// ══════════════════════════════════════════════════════════════════
//  8. Korean — friction signal with all conditions, combined block
// ══════════════════════════════════════════════════════════════════

const ctxKo = buildReportContext(frictionRows, {
  lang: 'ko', variant: 'monthlyBranch', period: '2026년 3월', scope: 'AMGN',
});

console.log('\n── 8. Korean friction + narrative ──');
console.log('S2:', ctxKo.narrative.s2);
ctxKo.recommendations.forEach(printCard);
ctxKo.observations.forEach(printCard);

assert(ctxKo._validation.ok, `ko: ${JSON.stringify(ctxKo._validation.errors)}`);
assert(ctxKo.anomalyKey === 's2.frictionSignal', `ko: expected frictionSignal`);

// ══════════════════════════════════════════════════════════════════
//  9. Empty period — T01 strict recommendation, s2.empty exempt
// ══════════════════════════════════════════════════════════════════

const ctxEmpty = buildReportContext([], {
  lang: 'en', variant: 'monthlyBranch', period: 'March 2026', scope: 'AMGN',
});

console.log('\n── 9. Empty period ──');
ctxEmpty.recommendations.forEach(printCard);
ctxEmpty.observations.forEach(printCard);
console.log('valid:', ctxEmpty._validation);

assert(ctxEmpty.anomalyKey === 's2.empty');
assert(ctxEmpty._validation.ok, `empty: ${JSON.stringify(ctxEmpty._validation.errors)}`);
const t01 = ctxEmpty.recommendations.find(r => r.id === 'T01');
assert(t01 && t01.strength === 'strict', 'T01 must be strict recommendation');

console.log('\n✓ All smoke assertions passed.');
