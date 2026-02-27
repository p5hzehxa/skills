import type { EvalResult } from './types.ts';
import type { ReviewLabel } from './labels.ts';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export interface CalibrationResult {
  totalLabeled: number;
  agreement: number;
  falsePositives: number;
  falseNegatives: number;
  perProduct: Record<string, { labeled: number; agreement: number }>;
  threshold: number;
  passed: boolean;
}

/**
 * Compare scorer decisions against human labels.
 * Scorer says "ship" if delta >= 0, "no-ship" if delta < 0.
 * Labels that reference cases not in results are skipped.
 */
export function computeCalibration(labels: ReviewLabel[], results: EvalResult[], threshold = 0.8): CalibrationResult {
  const resultMap = new Map(results.map((r) => [r.caseId, r]));

  let agreed = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let matched = 0;

  // Per-product accumulators
  const products: Record<string, { agreed: number; total: number }> = {};

  // Dedupe labels: use latest per case
  const latestByCase = new Map<string, ReviewLabel>();
  for (const l of labels) {
    const existing = latestByCase.get(l.caseId);
    if (!existing || l.timestamp > existing.timestamp) {
      latestByCase.set(l.caseId, l);
    }
  }

  for (const [caseId, label] of latestByCase) {
    const result = resultMap.get(caseId);
    if (!result) continue;

    matched++;
    const scorerShip = result.delta >= 0;
    const humanShip = label.ship;

    const product = result.product;
    if (!products[product]) products[product] = { agreed: 0, total: 0 };
    products[product].total++;

    if (scorerShip === humanShip) {
      agreed++;
      products[product].agreed++;
    } else if (scorerShip && !humanShip) {
      falsePositives++;
    } else {
      falseNegatives++;
    }
  }

  const agreementRatio = matched > 0 ? agreed / matched : 0;
  const perProduct: Record<string, { labeled: number; agreement: number }> = {};
  for (const [prod, acc] of Object.entries(products)) {
    perProduct[prod] = {
      labeled: acc.total,
      agreement: acc.total > 0 ? Math.round((acc.agreed / acc.total) * 100) / 100 : 0,
    };
  }

  return {
    totalLabeled: matched,
    agreement: Math.round(agreementRatio * 100) / 100,
    falsePositives,
    falseNegatives,
    perProduct,
    threshold,
    passed: matched < 10 || agreementRatio >= threshold,
  };
}

/** Print calibration results to console. */
export function printCalibration(cal: CalibrationResult): void {
  if (cal.totalLabeled === 0) {
    console.log(`\n${DIM}  Calibration: no labels found. Use \`pnpm eval:label\` to add.${RESET}`);
    return;
  }

  const pct = Math.round(cal.agreement * 100);
  const status =
    cal.totalLabeled < 10
      ? `${DIM}(< 10 labels, not gating)${RESET}`
      : cal.passed
        ? `${GREEN}✓ above ${Math.round(cal.threshold * 100)}% threshold${RESET}`
        : `${RED}✗ below ${Math.round(cal.threshold * 100)}% threshold${RESET}`;

  console.log(`\n  Calibration (${cal.totalLabeled} labels):`);
  console.log(
    `    Agreement:        ${pct}% (${Math.round(cal.agreement * cal.totalLabeled)}/${cal.totalLabeled})  ${status}`,
  );
  console.log(`    False positives:  ${cal.falsePositives}  ${DIM}(scorer: ship, human: no-ship)${RESET}`);
  console.log(`    False negatives:  ${cal.falseNegatives}  ${DIM}(scorer: no-ship, human: ship)${RESET}`);

  const productEntries = Object.entries(cal.perProduct);
  if (productEntries.length > 0) {
    console.log('\n    Per product:');
    for (const [prod, stats] of productEntries.sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(
        `      ${prod.padEnd(18)} ${String(stats.labeled).padStart(2)} labels  ${Math.round(stats.agreement * 100)}% agreement`,
      );
    }
  }
}
