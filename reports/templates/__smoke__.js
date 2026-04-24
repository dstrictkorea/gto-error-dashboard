'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/templates/__smoke__.js
//
//  Template-compile smoke test — does NOT launch Puppeteer.
//  Verifies:
//    · All partials register cleanly
//    · monthly-branch / monthly-global / annual templates compile
//    · Contract §1 — strict vs soft badge/class distinction
//    · Contract §2 — observation cards carry no action/badge
//    · Contract §3 — combined block respects max-3 bullets + "...more" line
//    · Contract §4 — section headers gate on non-empty arrays only
//    · Contract §5 — empty-case message renders when both arrays empty
//
//  Run: node reports/templates/__smoke__.js
// ══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Pull helpers + partial registration logic from the renderer.
const { _internals } = require('../renderer');
_internals.registerPartialsOnce();

// The renderer registered its own Handlebars; use it so helpers match.
const HB = _internals.Handlebars;

const TEMPLATES_DIR = path.join(__dirname);

function compile(name) {
  const src = fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.hbs`), 'utf8');
  return HB.compile(src, { noEscape: false });
}

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
}

const { buildReportContext } = require('../content/index');

// ── Fixture builders (mirror reports/content/__smoke__.js patterns) ──

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
//  TEST 1 — monthly-branch compiles with friction fixture (has obs)
// ══════════════════════════════════════════════════════════════════
const frictionRows = Array.from({ length: 200 }, (_, i) => mkRow(i, {
  Date: new Date(2026, 2, 1 + (i % 20)).toISOString().slice(0, 10),
  Difficulty: (i % 3 === 0) ? 4 : 2,
  TimeTaken: '95',
}));
const ctxBranch = buildReportContext(frictionRows, {
  lang: 'en', variant: 'monthlyBranch', period: 'March 2026',
  scope: 'AMGN', generated: '2026-04-01',
});

const branchTpl = compile('monthly-branch');
const branchHtml = branchTpl(ctxBranch);

console.log('── 1. monthly-branch (EN, friction) ──');
console.log('   html length:', branchHtml.length);
console.log('   obs count  :', ctxBranch.observations.length);
console.log('   rec count  :', ctxBranch.recommendations.length);

assert(branchHtml.length > 500, 'branch HTML should have substantive content');
if (ctxBranch.observations.length > 0) {
  assert(branchHtml.includes('ev-section--obs'), 'obs section should render when observations exist');
}
if (ctxBranch.recommendations.length > 0) {
  assert(branchHtml.includes('ev-section--recs'), 'recs section should render when recs exist');
}

// ══════════════════════════════════════════════════════════════════
//  TEST 2 — monthly-global compiles, shows both recs + obs sections
// ══════════════════════════════════════════════════════════════════
const globalRows = Array.from({ length: 240 }, (_, i) => {
  const r = mkRow(i, { Zone: i < 120 ? (i % 3 === 0 ? 'Hall A' : 'Hall B') : 'Zone X' });
  if (i % 6 === 0) r.Severity = 'Critical';
  return r;
});
const ctxGlobal = buildReportContext(globalRows, {
  lang: 'en', variant: 'monthlyGlobal', period: 'March 2026',
  scope: 'Global', generated: '2026-04-01',
});

const globalTpl = compile('monthly-global');
const globalHtml = globalTpl(ctxGlobal);

console.log('\n── 2. monthly-global (EN, critical spike) ──');
console.log('   html length :', globalHtml.length);
console.log('   rec count   :', ctxGlobal.recommendations.length);
console.log('   strengths   :', ctxGlobal.recommendations.map(r => r.strength).join(','));

assert(globalHtml.length > 500, 'global HTML should have substantive content');
// Contract §3: cap at 3 recommendations
assert(ctxGlobal.recommendations.length <= 3,
  `recs cap failed: got ${ctxGlobal.recommendations.length}`);

// Contract §1: each rec produces a strength-tagged card class
ctxGlobal.recommendations.forEach((r, i) => {
  const wantClass = `card--${r.strength}`;
  assert(globalHtml.includes(wantClass),
    `rec #${i + 1} (${r.id}) should render .${wantClass}`);
});

// ══════════════════════════════════════════════════════════════════
//  TEST 3 — empty-case renders the stable-operations message
// ══════════════════════════════════════════════════════════════════
// Fabricate an empty context (bypass content pipeline to isolate templating).
const ctxEmpty = {
  lang: 'en', variant: 'monthlyBranch', period: 'March 2026', scope: 'AMGN',
  generated: '2026-04-01',
  labels: {
    title: 'Incident Operations Report',
    executiveSummary: 'Executive Summary',
    kpiStrip: 'Key Metrics',
    recommendations: 'Recommendations',
    observations: 'Observations',
    observed: 'Observed',
    recommendedAction: 'Recommended action',
    page: 'Page',
  },
  kpis: [], narrative: { s1: '', s2: '', s3: '', s4: '' },
  recommendations: [], observations: [], confidenceLegend: null,
};

const emptyHtml = compile('monthly-branch')(ctxEmpty);
console.log('\n── 3. empty-case branch ──');
console.log('   contains stable msg :', emptyHtml.includes('Operations stable'));
assert(emptyHtml.includes('Operations stable'), 'empty case must show stable-ops message');
assert(!emptyHtml.includes('ev-section__header'), 'empty case must not render section headers');

// Korean empty case
const ctxEmptyKo = Object.assign({}, ctxEmpty, { lang: 'ko',
  labels: Object.assign({}, ctxEmpty.labels, { title: '인시던트 운영 리포트' }) });
const emptyHtmlKo = compile('monthly-branch')(ctxEmptyKo);
assert(emptyHtmlKo.includes('운영이 안정적'), 'KO empty case must show 운영이 안정적');

// ══════════════════════════════════════════════════════════════════
//  TEST 4 — strict vs soft rec visual distinction
// ══════════════════════════════════════════════════════════════════
const ctxStrict = Object.assign({}, ctxEmpty, {
  recommendations: [{
    id: 'T04', type: 'recommendation', strength: 'strict',
    title: 'Test strict rec', observed: 'Fact', action: 'Do the thing.',
  }],
  observations: [],
});
const strictHtml = compile('monthly-branch')(ctxStrict);
assert(strictHtml.includes('card--strict'), 'strict card class present');
assert(strictHtml.includes('ACTION REQUIRED'), 'strict badge text');
assert(strictHtml.includes('Recommended action'), 'strict action label');
assert(!strictHtml.includes('REVIEW SUGGESTED'), 'no soft badge leak');

const ctxSoft = Object.assign({}, ctxEmpty, {
  recommendations: [{
    id: 'T02', type: 'recommendation', strength: 'soft',
    title: 'Test soft rec', observed: 'Fact',
    action: 'Consider looking into this pattern.',
  }],
  observations: [],
});
const softHtml = compile('monthly-branch')(ctxSoft);
assert(softHtml.includes('card--soft'), 'soft card class present');
assert(softHtml.includes('REVIEW SUGGESTED'), 'soft badge text');
assert(softHtml.includes('Review if needed'), 'soft action label');
assert(!softHtml.includes('ACTION REQUIRED'), 'no strict badge leak');
console.log('\n── 4. strict/soft distinction OK ──');

// ══════════════════════════════════════════════════════════════════
//  TEST 5 — combined observation bullet cap + overflow line
// ══════════════════════════════════════════════════════════════════
// Synthesise a combined card with 5 sources → should render 3 bullets
// + overflow line. The content layer produces observed as newline-separated
// lines already prefixed with "· ", so we mirror that shape here.
const manyBullets = ['Line A', 'Line B', 'Line C', 'Line D', 'Line E'];
const visible = manyBullets.slice(0, 3);
const overflowN = manyBullets.length - visible.length;
const observedBlob = visible.map(s => `· ${s}`).join('\n')
  + `\n· …and ${overflowN} more patterns observed`;

const ctxCombined = Object.assign({}, ctxEmpty, {
  recommendations: [],
  observations: [{
    id: 'COMBINED_ZONE', type: 'combinedObservation',
    title: 'Patterns observed',
    observed: observedBlob,
    note: 'No action is recommended for these secondary patterns.',
    sources: ['T02','T04','T05','T10','T14'],
    count: 5, truncatedCount: overflowN,
  }],
});
const combHtml = compile('monthly-branch')(ctxCombined);
const bulletMatches = (combHtml.match(/<li /g) || []).length;
console.log('\n── 5. combined observation ──');
console.log('   bullets rendered:', bulletMatches);
assert(bulletMatches === 4, `expected 4 <li> (3 real + 1 overflow), got ${bulletMatches}`);
assert(combHtml.includes('…and 2 more patterns observed'), 'overflow line present');
assert(combHtml.includes('overflow'), 'overflow class applied to tail line');

// ══════════════════════════════════════════════════════════════════
//  TEST 6 — annual template compiles with same shape
// ══════════════════════════════════════════════════════════════════
const annualCtx = Object.assign({}, ctxGlobal, {
  variant: 'annual', period: '2026',
  labels: Object.assign({}, ctxGlobal.labels, { title: 'Annual Operations Report' }),
});
const annualHtml = compile('annual')(annualCtx);
assert(annualHtml.length > 500, 'annual should render substantive content');
console.log('\n── 6. annual template compiles ──');

// ══════════════════════════════════════════════════════════════════
//  TEST 7 — observation cards carry no action/badge
// ══════════════════════════════════════════════════════════════════
const ctxObsOnly = Object.assign({}, ctxEmpty, {
  recommendations: [],
  observations: [{
    id: 'T14', type: 'observation',
    title: 'Operational friction signal observed',
    observed: 'High handling difficulty + long resolution times across 20 days.',
    note: 'Reported handling difficulty and resolution patterns suggest operational strain.',
  }],
});
const obsHtml = compile('monthly-branch')(ctxObsOnly);
assert(obsHtml.includes('card--obs'), 'obs card class present');
assert(!obsHtml.includes('ACTION REQUIRED') && !obsHtml.includes('REVIEW SUGGESTED'),
  'obs must not carry rec badges');
assert(!obsHtml.includes('Recommended action') && !obsHtml.includes('Review if needed'),
  'obs must not carry action labels');
console.log('\n── 7. observation card clean ──');

console.log('\n✓ All template smoke assertions passed.');
