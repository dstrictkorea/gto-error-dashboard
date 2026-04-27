'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/scripts/dry-run.js
//
//  Generates 6 PDFs from synthetic representative data:
//    1. Monthly Branch EN
//    2. Monthly Branch KO
//    3. Monthly Global EN
//    4. Monthly Global KO
//    5. Annual EN
//    6. Annual KO
//
//  Run: node reports/scripts/dry-run.js [--out <dir>]
//  Output defaults to reports/scripts/out/
//
//  Uses synthetic data shaped like real normLog output.
//  No SharePoint connection required.
// ══════════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');
const { renderPdf, closeRenderer } = require('../renderer');
const { buildMonthlyBranchContext, buildMonthlyGlobalContext, buildAnnualContext } = require('../context');

// ── Output directory ─────────────────────────────────────────────
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT_DIR = outIdx >= 0 ? args[outIdx + 1] : path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Synthetic data generators ────────────────────────────────────

const ISSUE_DETAILS = [
  'Cafe counter wall display was glitching intermittently.',
  'LED panel in main hall showing color desync.',
  'Network switch reboot required after power fluctuation.',
  'Touch sensor unresponsive — calibration drift detected.',
  'Mechanical arm stopped mid-sequence, safety lock triggered.',
  'Screen tearing on south facade during high-brightness mode.',
  'Controller lost signal to zone B projection unit.',
  'Audio sync issue with video wall in lobby.',
  'Fan RPM alarm triggered in server rack near Zone X.',
  'Pixel rows 120-130 dark on hall A east panel.',
];
const ACTION_DETAILS = [
  'Replaced module and verified operation.',
  'Performed soft reset; restored normal operation.',
  'Re-seated cable harness; confirmed stable output.',
  'Applied firmware patch v3.1.4; rebooted system.',
  'Cleared error log and ran diagnostic cycle.',
  'Recalibrated sensor array; issue resolved.',
  'Switched to backup unit; scheduled primary repair.',
  'Cleaned optical surface; realigned projector.',
];
const SOLVERS = ['Kim J.', 'Lee S.', 'Park H.', 'Choi D.', 'Jung Y.'];
const ACTION_TYPES = ['On-Site', 'On-Site', 'On-Site', 'Remote', 'Remote'];

function isoDate(year, month0, day) {
  // month0 is 0-based (Jan=0). Returns "YYYY-MM-DD" in local time safely.
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function mkRow(i, overrides) {
  return Object.assign({
    Branch: 'AMGN',
    Zone: i % 3 === 0 ? 'Hall A' : (i % 3 === 1 ? 'Hall B' : 'Lobby'),
    Date: isoDate(2026, 2, 1 + (i % 27)),   // March 2026, days 1-27
    Time: `${9 + (i % 10)}:${String((i * 7) % 60).padStart(2, '0')}`,
    TimeTaken: String(30 + (i % 90)),
    Category: ['Sensor', 'Network', 'Mechanical', 'Power'][i % 4],
    'Issue Detail': ISSUE_DETAILS[i % ISSUE_DETAILS.length],
    ActionTaken: i % 10 === 0 ? '' : ACTION_DETAILS[i % ACTION_DETAILS.length],
    'Action Type': ACTION_TYPES[i % ACTION_TYPES.length],
    Difficulty: (i % 7 === 0) ? 4 : 2,
    'Solved By': SOLVERS[i % SOLVERS.length],
    Severity: '',
  }, overrides || {});
}

// Branch scenario: friction signal present (high difficulty + slow resolve + recurrence)
function branchRows() {
  return Array.from({ length: 200 }, (_, i) => mkRow(i, {
    Date: new Date(2026, 2, 1 + (i % 20)).toISOString().slice(0, 10),
    Difficulty: i % 3 === 0 ? 4 : 2,
    TimeTaken: '95',
  }));
}

// Global scenario: severity critical spike + zone concentration
function globalRows() {
  const rows = Array.from({ length: 240 }, (_, i) => {
    const row = mkRow(i, {
      Branch: i < 80 ? 'AMGN' : (i < 160 ? 'AMNY' : 'AMLV'),
      Zone: i < 120 ? (i % 3 === 0 ? 'Hall A' : 'Hall B') : 'Zone X',
    });
    if (i % 6 === 0) row.Severity = 'Critical';
    return row;
  });
  return rows;
}

// Annual scenario: full-year spread (12 months) with severity data
function annualRows() {
  const out = [];
  for (let m = 0; m < 12; m++) {
    for (let i = 0; i < 30; i++) {
      const row = mkRow(i + m * 30, {
        Branch: ['AMGN','AMNY','AMLV'][ i % 3 ],
        Date: new Date(2025, m, 1 + (i % 28)).toISOString().slice(0, 10),
        TimeTaken: String(40 + (i % 80)),
      });
      if (i % 8 === 0) row.Severity = 'Critical';
      out.push(row);
    }
  }
  return out;
}

// ── PDF jobs ─────────────────────────────────────────────────────

const JOBS = [
  {
    name: 'monthly-branch-en',
    template: 'monthly-branch',
    ctxFn: () => buildMonthlyBranchContext(branchRows(), {
      lang: 'en', period: 'March 2026', scope: 'AMGN',
      generated: '24 Apr 2026',
    }),
  },
  {
    name: 'monthly-branch-ko',
    template: 'monthly-branch',
    ctxFn: () => buildMonthlyBranchContext(branchRows(), {
      lang: 'ko', period: '2026년 3월', scope: 'AMGN',
      generated: '2026년 4월 24일',
    }),
  },
  {
    name: 'monthly-global-en',
    template: 'monthly-global',
    ctxFn: () => buildMonthlyGlobalContext(globalRows(), {
      lang: 'en', period: 'March 2026', scope: 'All Branches',
      generated: '24 Apr 2026',
    }),
  },
  {
    name: 'monthly-global-ko',
    template: 'monthly-global',
    ctxFn: () => buildMonthlyGlobalContext(globalRows(), {
      lang: 'ko', period: '2026년 3월', scope: '전체 지사',
      generated: '2026년 4월 24일',
    }),
  },
  {
    name: 'annual-en',
    template: 'annual',
    ctxFn: () => buildAnnualContext(annualRows(), {
      lang: 'en', period: '2025', scope: 'All Branches',
      generated: '24 Apr 2026',
    }),
  },
  {
    name: 'annual-ko',
    template: 'annual',
    ctxFn: () => buildAnnualContext(annualRows(), {
      lang: 'ko', period: '2025년', scope: '전체 지사',
      generated: '2026년 4월 24일',
    }),
  },
];

// ── Runner ───────────────────────────────────────────────────────

async function run() {
  console.log(`\n[dry-run] Output → ${OUT_DIR}\n`);
  const results = [];

  for (const job of JOBS) {
    const t0 = Date.now();
    try {
      const ctx = job.ctxFn();

      // Pre-render validation check
      if (!ctx._validation || !ctx._validation.ok) {
        const errs = ctx._validation ? ctx._validation.errors : ['no validation result'];
        console.error(`  ✗ ${job.name}: validation FAILED — ${errs.join('; ')}`);
        results.push({ name: job.name, ok: false, error: errs.join('; ') });
        continue;
      }

      const pdf  = await renderPdf({ template: job.template, data: ctx });
      const out  = path.join(OUT_DIR, `${job.name}.pdf`);
      fs.writeFileSync(out, pdf);
      const ms   = Date.now() - t0;
      const kb   = Math.round(pdf.length / 1024);
      console.log(`  ✓ ${job.name}.pdf  ${kb}KB  ${ms}ms  recs=${ctx.recommendations.length}  obs=${ctx.observations.length}`);
      results.push({ name: job.name, ok: true, kb, ms, path: out,
        recs: ctx.recommendations.length, obs: ctx.observations.length,
        anomalyKey: ctx.anomalyKey });
    } catch (e) {
      const ms = Date.now() - t0;
      console.error(`  ✗ ${job.name}: FAILED (${ms}ms) — ${e.message}`);
      results.push({ name: job.name, ok: false, error: e.message });
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n[dry-run] ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\n[dry-run] FAILURES:');
    results.filter(r => !r.ok).forEach(r => console.error(`  ${r.name}: ${r.error}`));
    process.exitCode = 1;
  }

  await closeRenderer();
}

run().catch(e => { console.error('[dry-run] fatal:', e); process.exit(1); });
