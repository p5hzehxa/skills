import { describe, expect, it } from 'vitest';
import { computeCalibration } from '../eval/calibrate.ts';
import type { EvalResult, ScoreCard } from '../eval/types.ts';
import type { ReviewLabel } from '../eval/labels.ts';

function makeScoreCard(overrides: Partial<ScoreCard> = {}): ScoreCard {
  return {
    methodAccuracy: 1,
    paramAccuracy: 1,
    envVarCoverage: 1,
    importAccuracy: 1,
    flowCorrectness: 1,
    antiPatternAvoidance: 1,
    hallucinationCount: 0,
    composite: 95,
    ...overrides,
  };
}

function makeResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    caseId: 'test-case',
    product: 'sso',
    skillType: 'generated',
    withSkill: { output: '', scores: makeScoreCard(), tokenUsage: { input: 0, output: 0 } },
    withoutSkill: { output: '', scores: makeScoreCard({ composite: 90 }), tokenUsage: { input: 0, output: 0 } },
    delta: 5,
    topErrors: [],
    withSkillErrors: [],
    withoutSkillErrors: [],
    sampleCount: 1,
    withSkillStddev: 0,
    withoutSkillStddev: 0,
    deltaStddev: 0,
    ...overrides,
  };
}

function makeLabel(overrides: Partial<ReviewLabel> = {}): ReviewLabel {
  return {
    caseId: 'test-case',
    runId: 'run-1',
    ship: true,
    who: 'nick',
    reason: 'looks good',
    timestamp: '2026-02-26T00:00:00Z',
    compositeWith: 95,
    compositeWithout: 90,
    ...overrides,
  };
}

describe('computeCalibration', () => {
  it('returns 100% agreement when scorer and labels fully align', () => {
    const results = [
      makeResult({ caseId: 'a', delta: 5 }), // scorer: ship
      makeResult({ caseId: 'b', delta: -3 }), // scorer: no-ship
    ];
    const labels = [makeLabel({ caseId: 'a', ship: true }), makeLabel({ caseId: 'b', ship: false })];
    const cal = computeCalibration(labels, results);
    expect(cal.agreement).toBe(1);
    expect(cal.falsePositives).toBe(0);
    expect(cal.falseNegatives).toBe(0);
  });

  it('returns 0% agreement when fully misaligned', () => {
    const results = [
      makeResult({ caseId: 'a', delta: 5 }), // scorer: ship
      makeResult({ caseId: 'b', delta: -3 }), // scorer: no-ship
    ];
    const labels = [
      makeLabel({ caseId: 'a', ship: false }), // disagree
      makeLabel({ caseId: 'b', ship: true }), // disagree
    ];
    const cal = computeCalibration(labels, results);
    expect(cal.agreement).toBe(0);
    expect(cal.falsePositives).toBe(1);
    expect(cal.falseNegatives).toBe(1);
  });

  it('passes gate at exactly 80% agreement with 10+ labels', () => {
    const results = Array.from({ length: 10 }, (_, i) => makeResult({ caseId: `c${i}`, delta: 5, product: 'sso' }));
    const labels = results.map((r, i) => makeLabel({ caseId: r.caseId, ship: i < 8 })); // 8 agree, 2 disagree
    const cal = computeCalibration(labels, results, 0.8);
    expect(cal.agreement).toBe(0.8);
    expect(cal.passed).toBe(true);
  });

  it('fails gate below 80% with 10+ labels', () => {
    const results = Array.from({ length: 10 }, (_, i) => makeResult({ caseId: `c${i}`, delta: 5 }));
    const labels = results.map((r, i) => makeLabel({ caseId: r.caseId, ship: i < 7 })); // 7 agree, 3 disagree
    const cal = computeCalibration(labels, results, 0.8);
    expect(cal.agreement).toBe(0.7);
    expect(cal.passed).toBe(false);
  });

  it('passes gate when < 10 labels regardless of agreement', () => {
    const results = [makeResult({ caseId: 'a', delta: 5 })];
    const labels = [makeLabel({ caseId: 'a', ship: false })]; // disagree
    const cal = computeCalibration(labels, results, 0.8);
    expect(cal.agreement).toBe(0);
    expect(cal.passed).toBe(true); // < 10 labels = no gating
  });

  it('skips labels for cases not in results', () => {
    const results = [makeResult({ caseId: 'a', delta: 5 })];
    const labels = [makeLabel({ caseId: 'a', ship: true }), makeLabel({ caseId: 'missing', ship: false })];
    const cal = computeCalibration(labels, results);
    expect(cal.totalLabeled).toBe(1);
    expect(cal.agreement).toBe(1);
  });

  it('handles empty labels', () => {
    const cal = computeCalibration([], [makeResult()]);
    expect(cal.totalLabeled).toBe(0);
    expect(cal.agreement).toBe(0);
    expect(cal.passed).toBe(true); // no labels = pass
  });

  it('computes per-product breakdown', () => {
    const results = [
      makeResult({ caseId: 'a', product: 'sso', delta: 5 }),
      makeResult({ caseId: 'b', product: 'rbac', delta: -2 }),
    ];
    const labels = [makeLabel({ caseId: 'a', ship: true }), makeLabel({ caseId: 'b', ship: false })];
    const cal = computeCalibration(labels, results);
    expect(cal.perProduct.sso).toEqual({ labeled: 1, agreement: 1 });
    expect(cal.perProduct.rbac).toEqual({ labeled: 1, agreement: 1 });
  });

  it('uses latest label per case when duplicates exist', () => {
    const results = [makeResult({ caseId: 'a', delta: 5 })];
    const labels = [
      makeLabel({ caseId: 'a', ship: false, timestamp: '2026-01-01T00:00:00Z' }),
      makeLabel({ caseId: 'a', ship: true, timestamp: '2026-02-01T00:00:00Z' }),
    ];
    const cal = computeCalibration(labels, results);
    expect(cal.agreement).toBe(1); // latest label is ship=true, scorer is ship (delta>=0)
  });

  it('treats delta=0 as scorer saying ship', () => {
    const results = [makeResult({ caseId: 'a', delta: 0 })];
    const labels = [makeLabel({ caseId: 'a', ship: true })];
    const cal = computeCalibration(labels, results);
    expect(cal.agreement).toBe(1);
  });
});
