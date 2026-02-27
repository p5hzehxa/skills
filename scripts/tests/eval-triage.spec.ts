import { describe, expect, it } from 'vitest';
import { scoreRisk, rankByRisk } from '../eval/triage.ts';
import type { EvalResult, ScoreCard } from '../eval/types.ts';

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
    withSkill: {
      output: '',
      scores: makeScoreCard({ composite: 95 }),
      tokenUsage: { input: 100, output: 100 },
    },
    withoutSkill: {
      output: '',
      scores: makeScoreCard({ composite: 90 }),
      tokenUsage: { input: 100, output: 100 },
    },
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

describe('scoreRisk', () => {
  it('scores 0 for a healthy positive-delta case', () => {
    const t = scoreRisk(makeResult({ delta: 10, deltaStddev: 0 }));
    expect(t.riskScore).toBe(0);
    expect(t.riskFactors).toHaveLength(0);
  });

  it('scores 60 for negative delta in marginal range', () => {
    const t = scoreRisk(makeResult({ delta: -2 }));
    expect(t.riskScore).toBe(60); // 40 (negative) + 20 (marginal)
    expect(t.riskFactors).toContain('negative delta');
    expect(t.riskFactors).toContain('marginal negative');
  });

  it('scores 40 for large negative delta (not marginal)', () => {
    const t = scoreRisk(makeResult({ delta: -10 }));
    expect(t.riskScore).toBe(40); // 40 (negative), not marginal
    expect(t.riskFactors).toContain('negative delta');
    expect(t.riskFactors).not.toContain('marginal negative');
  });

  it('scores 30 for σ > signal', () => {
    const t = scoreRisk(makeResult({ delta: 5, deltaStddev: 10 }));
    expect(t.riskScore).toBe(30);
    expect(t.riskFactors).toContain('σ > signal');
  });

  it('scores 15 for unstable baseline', () => {
    const t = scoreRisk(makeResult({ delta: 5, withoutSkillStddev: 8 }));
    expect(t.riskScore).toBe(15);
    expect(t.riskFactors).toContain('unstable baseline');
  });

  it('scores 10 for zero delta with imperfect score', () => {
    const t = scoreRisk(
      makeResult({
        delta: 0,
        withSkill: {
          output: '',
          scores: makeScoreCard({ composite: 80 }),
          tokenUsage: { input: 100, output: 100 },
        },
      }),
    );
    expect(t.riskScore).toBe(10);
    expect(t.riskFactors).toContain('zero delta, imperfect score');
  });

  it('does not score zero delta when composite is 95+', () => {
    const t = scoreRisk(makeResult({ delta: 0 }));
    expect(t.riskScore).toBe(0);
  });

  it('scores 25 for hallucination regression', () => {
    const t = scoreRisk(
      makeResult({
        delta: 5,
        withSkill: {
          output: '',
          scores: makeScoreCard({ composite: 95, hallucinationCount: 2 }),
          tokenUsage: { input: 100, output: 100 },
        },
        withoutSkill: {
          output: '',
          scores: makeScoreCard({ composite: 90, hallucinationCount: 0 }),
          tokenUsage: { input: 100, output: 100 },
        },
      }),
    );
    expect(t.riskScore).toBe(25);
    expect(t.riskFactors).toContain('hallucination regression');
  });

  it('caps at 100', () => {
    const t = scoreRisk(
      makeResult({
        delta: -2,
        deltaStddev: 10,
        withoutSkillStddev: 8,
        withSkill: {
          output: '',
          scores: makeScoreCard({ composite: 80, hallucinationCount: 3 }),
          tokenUsage: { input: 100, output: 100 },
        },
        withoutSkill: {
          output: '',
          scores: makeScoreCard({ composite: 82, hallucinationCount: 0 }),
          tokenUsage: { input: 100, output: 100 },
        },
      }),
    );
    // 40 + 20 + 30 + 15 + 25 = 130, capped at 100
    expect(t.riskScore).toBe(100);
  });
});

describe('rankByRisk', () => {
  it('returns empty for empty input', () => {
    expect(rankByRisk([])).toHaveLength(0);
  });

  it('filters out zero-risk cases', () => {
    const results = [makeResult({ delta: 10 })];
    expect(rankByRisk(results)).toHaveLength(0);
  });

  it('sorts by risk descending', () => {
    const results = [
      makeResult({
        caseId: 'low-risk',
        delta: 0,
        withSkill: { output: '', scores: makeScoreCard({ composite: 80 }), tokenUsage: { input: 0, output: 0 } },
      }),
      makeResult({ caseId: 'high-risk', delta: -2 }),
    ];
    const ranked = rankByRisk(results);
    expect(ranked[0].caseId).toBe('high-risk');
    expect(ranked[1].caseId).toBe('low-risk');
  });
});
