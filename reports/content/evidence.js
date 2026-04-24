'use strict';

// ══════════════════════════════════════════════════════════════════
//  reports/content/evidence.js
//
//  SAFETY LAYER — Recommendation Confidence Gate
//
//  Every recommendation trigger must pass this scorer before it is
//  allowed to emit an actionable recommendation. Below the gate, the
//  finding is re-emitted as an observation with the required
//  "insufficient evidence for action recommendation" note.
//
//  Factors (each in [0,1]):
//    sampleSize       n / minN
//    dominance        (share - threshold) / threshold  vs. minMarginRel
//    temporalSpread   distinctDays / minDistinctDays
//    noiseResistance  1 once maxDayShare ≤ cap; drops linearly past
//
//  Combination rule (PRIMARY PATH, strict):
//    score = min(factors)
//    pass if score ≥ MIN_CONFIDENCE
//
//  SECONDARY PATH (controlled relaxation — does NOT weaken the 0.95
//  rule; it only prevents suppression of strong signals that have one
//  noisy dimension):
//    pass if
//      (≥ 3 of 4 factors are ≥ MIN_CONFIDENCE)
//      AND n ≥ HIGH_CONFIDENCE_SAMPLE
//
//  The second path requires an independent sample-size floor so it
//  cannot be satisfied on thin data. That floor is strictly larger
//  than the minSample used by the sampleSize factor — defaults to
//  2× minSample.
//
//  Emitted object records which path (if any) passed, so observation
//  copy can explain failures and QA can audit gate behavior.
// ══════════════════════════════════════════════════════════════════

const MIN_CONFIDENCE = 0.95;
const STRONG_FACTOR_MIN_COUNT = 3;   // secondary path: at least 3 of 4 strong

const DEFAULTS = Object.freeze({
  minSample: 10,
  minMarginRelative: 0.20,
  minDistinctDays: 3,
  maxSingleDayShare: 0.50,
  // Secondary path sample floor. Trigger configs may raise this, but
  // we never lower it below 2 × minSample.
  highConfidenceSample: null,          // resolved to max(2 × minSample, explicit)
});

function clamp01(x) {
  if (!isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// ── Factor calculators ───────────────────────────────────────────

function sampleSizeFactor(n, minN) {
  if (!isFinite(n) || n <= 0) return 0;
  if (!isFinite(minN) || minN <= 0) return 1;
  return clamp01(n / minN);
}

function dominanceMarginFactor(share, threshold, minMarginRel) {
  if (share == null || !isFinite(share)) return 0;
  if (!isFinite(threshold) || threshold <= 0) return 0;
  const margin = share - threshold;
  if (margin <= 0) return 0;
  const relMargin = margin / threshold;
  return clamp01(relMargin / minMarginRel);
}

function temporalSpreadFactor(distinctDays, minDays) {
  if (!isFinite(distinctDays) || distinctDays <= 0) return 0;
  if (!isFinite(minDays) || minDays <= 0) return 1;
  if (distinctDays >= minDays) return 1;
  return clamp01(distinctDays / minDays);
}

function noiseResistanceFactor(maxDayShare, cap) {
  if (maxDayShare == null) return 1;
  if (!isFinite(cap) || cap <= 0) return 1;
  if (maxDayShare <= cap) return 1;
  return clamp01(1 - (maxDayShare - cap) / cap);
}

// ── Gate evaluation ──────────────────────────────────────────────

function resolveHighConfidenceSample(cfg) {
  const defaultFloor = Math.max(20, (cfg.minSample || 10) * 2);
  if (!isFinite(cfg.highConfidenceSample) || cfg.highConfidenceSample == null) {
    return defaultFloor;
  }
  return Math.max(cfg.highConfidenceSample, defaultFloor);
}

function scoreEvidence(spec) {
  const cfg = Object.assign({}, DEFAULTS, (spec && spec.config) || {});
  const hcSample = resolveHighConfidenceSample(cfg);

  const factors = {
    sampleSize: ('n' in spec) ? sampleSizeFactor(spec.n, cfg.minSample) : 1,
    dominance: ('share' in spec && 'threshold' in spec)
      ? dominanceMarginFactor(spec.share, spec.threshold, cfg.minMarginRelative)
      : 1,
    temporal: ('distinctDays' in spec)
      ? temporalSpreadFactor(spec.distinctDays, cfg.minDistinctDays)
      : 1,
    noise: ('maxDayShare' in spec)
      ? noiseResistanceFactor(spec.maxDayShare, cfg.maxSingleDayShare)
      : 1,
  };

  const score = Math.min(factors.sampleSize, factors.dominance, factors.temporal, factors.noise);
  const strongCount = Object.values(factors).filter(f => f >= MIN_CONFIDENCE).length;

  // PRIMARY path: strict min() ≥ 0.95
  const primaryPass = score >= MIN_CONFIDENCE;

  // SECONDARY path: 3-of-4 strong AND n ≥ high-confidence sample.
  // The sample floor is independent of the sampleSize factor — it
  // guarantees the permissive path never fires on thin data.
  const hasN = ('n' in spec);
  const nValue = hasN ? Number(spec.n) : NaN;
  const sampleMeetsSecondary = hasN && isFinite(nValue) && nValue >= hcSample;
  const secondaryPass = !primaryPass
    && strongCount >= STRONG_FACTOR_MIN_COUNT
    && sampleMeetsSecondary;

  const pass = primaryPass || secondaryPass;
  const passPath = primaryPass ? 'strict' : (secondaryPass ? 'dualPath' : null);

  // failing: factor names under MIN_CONFIDENCE — used for grounded
  // observation copy and QA audit.
  const failing = [];
  if (factors.sampleSize < MIN_CONFIDENCE) failing.push('sampleSize');
  if (factors.dominance < MIN_CONFIDENCE) failing.push('dominance');
  if (factors.temporal < MIN_CONFIDENCE) failing.push('temporal');
  if (factors.noise < MIN_CONFIDENCE) failing.push('noise');

  return {
    score,
    pass,
    passPath,
    factors,
    strongCount,
    failing,
    config: cfg,
    hcSample,
    n: hasN ? nValue : null,
  };
}

module.exports = {
  scoreEvidence,
  MIN_CONFIDENCE,
  STRONG_FACTOR_MIN_COUNT,
  DEFAULTS,
  _internals: {
    sampleSizeFactor, dominanceMarginFactor, temporalSpreadFactor, noiseResistanceFactor,
    resolveHighConfidenceSample, clamp01,
  },
};
