import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import type { EvalResult } from './types.ts';

const OUTPUT_DIR = join(process.cwd(), 'scripts', 'output');

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export interface TriageCase {
  caseId: string;
  product: string;
  riskScore: number;
  riskFactors: string[];
  delta: number;
  deltaStddev: number;
  withComposite: number;
  withoutComposite: number;
}

/** Score a single eval result for review risk. Higher = needs more attention. */
export function scoreRisk(r: EvalResult): TriageCase {
  let score = 0;
  const factors: string[] = [];

  // Negative delta — skill hurts
  if (r.delta < 0) {
    score += 40;
    factors.push('negative delta');
  }

  // Marginal negative — within noise range but still negative
  if (r.delta >= -3 && r.delta < 0) {
    score += 20;
    factors.push('marginal negative');
  }

  // High delta stddev — σ exceeds the signal
  if (r.deltaStddev > 0 && r.deltaStddev > Math.abs(r.delta)) {
    score += 30;
    factors.push('σ > signal');
  }

  // Unstable baseline
  if (r.withoutSkillStddev > 5) {
    score += 15;
    factors.push('unstable baseline');
  }

  // Skill adds no value but score isn't perfect
  if (r.delta === 0 && r.withSkill.scores.composite < 95) {
    score += 10;
    factors.push('zero delta, imperfect score');
  }

  // Hallucination regression — skill introduces hallucinations
  if (r.withSkill.scores.hallucinationCount > r.withoutSkill.scores.hallucinationCount) {
    score += 25;
    factors.push('hallucination regression');
  }

  return {
    caseId: r.caseId,
    product: r.product,
    riskScore: Math.min(100, score),
    riskFactors: factors,
    delta: r.delta,
    deltaStddev: r.deltaStddev,
    withComposite: r.withSkill.scores.composite,
    withoutComposite: r.withoutSkill.scores.composite,
  };
}

/** Rank all results by risk, descending. Filters out zero-risk cases. */
export function rankByRisk(results: EvalResult[]): TriageCase[] {
  return results
    .map(scoreRisk)
    .filter((t) => t.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore);
}

/** Print top N triage cases to console. */
export function printTriage(cases: TriageCase[], limit = 10): void {
  if (cases.length === 0) {
    console.log(`\n${DIM}  Triage: no risky cases found${RESET}`);
    return;
  }

  const shown = cases.slice(0, limit);
  console.log(`\n  Triage: Top ${Math.min(limit, cases.length)} Cases to Review`);
  for (let i = 0; i < shown.length; i++) {
    const t = shown[i];
    const color = t.riskScore >= 40 ? RED : YELLOW;
    const factors = t.riskFactors.length > 0 ? `  [${t.riskFactors.join(', ')}]` : '';
    console.log(`    ${color}#${i + 1}${RESET}  ${t.caseId.padEnd(32)} risk: ${t.riskScore}${factors}`);
  }
}

/** Write full triage ranking to JSON file. */
export async function writeTriageReport(cases: TriageCase[], runId: string): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `eval-triage-${runId.replace(/[:.]/g, '-')}.json`;
  const filepath = join(OUTPUT_DIR, filename);
  await writeFile(filepath, JSON.stringify({ runId, triageCases: cases }, null, 2));
  console.log(`${DIM}Triage report written to ${filepath}${RESET}`);
  return filepath;
}
