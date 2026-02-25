import { join } from "path";
import { mkdir } from "fs/promises";
import type { EvalReport } from "./types.ts";

const OUTPUT_DIR = join(process.cwd(), "scripts", "output");

// ANSI color codes
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function colorDelta(delta: number): string {
  const prefix = delta > 0 ? "+" : "";
  const str = `${prefix}${delta}%`;
  if (delta >= 20) return `${GREEN}${str}${RESET}`;
  if (delta >= 10) return `${YELLOW}${str}${RESET}`;
  return `${RED}${str}${RESET}`;
}

/** Print the eval results as a console table */
export function printTable(report: EvalReport): void {
  if (report.summary.length === 0) {
    console.log("\nNo results to display.\n");
    return;
  }

  console.log(`\n${"─".repeat(90)}`);
  console.log(`WorkOS Skill Eval Report`);
  console.log(
    `Model: ${report.model} | Cases: ${report.totalCases} | Date: ${report.runId.split("T")[0]}`,
  );
  console.log(`${"─".repeat(90)}\n`);

  // Header
  const h = [
    "Product".padEnd(18),
    "Cases".padStart(5),
    "With Skill".padStart(11),
    "Without".padStart(8),
    "Delta".padStart(8),
    "Top Errors",
  ];
  console.log(h.join("  "));
  console.log(`${"─".repeat(90)}`);

  // Rows
  for (const s of report.summary) {
    const suffix = s.skillType === "hand-crafted" ? " *" : "";
    const row = [
      `${s.product}${suffix}`.padEnd(18),
      String(s.caseCount).padStart(5),
      `${s.avgWithSkill}%`.padStart(11),
      `${s.avgWithoutSkill}%`.padStart(8),
      colorDelta(s.avgDelta).padStart(8 + 9), // ANSI codes add ~9 chars
      s.topErrors.join(", ") || DIM + "none" + RESET,
    ];
    console.log(row.join("  "));
  }

  console.log(`\n${DIM}* = hand-crafted skill${RESET}\n`);
}

/** Print summary stats */
export function printSummary(report: EvalReport): void {
  if (report.results.length === 0) return;

  const generated = report.summary.filter((s) => s.skillType === "generated");
  const handCrafted = report.summary.filter(
    (s) => s.skillType === "hand-crafted",
  );

  if (generated.length > 0) {
    const avgGenWith = Math.round(
      generated.reduce((s, g) => s + g.avgWithSkill, 0) / generated.length,
    );
    const avgGenDelta = Math.round(
      generated.reduce((s, g) => s + g.avgDelta, 0) / generated.length,
    );
    console.log(
      `Generated avg:     ${avgGenWith}%  (delta: ${colorDelta(avgGenDelta)})`,
    );
  }

  if (handCrafted.length > 0) {
    const avgHcWith = Math.round(
      handCrafted.reduce((s, h) => s + h.avgWithSkill, 0) / handCrafted.length,
    );
    const avgHcDelta = Math.round(
      handCrafted.reduce((s, h) => s + h.avgDelta, 0) / handCrafted.length,
    );
    console.log(
      `Hand-crafted avg:  ${avgHcWith}%  (delta: ${colorDelta(avgHcDelta)})`,
    );
  }

  // Token usage estimate
  const totalTokens = report.results.reduce(
    (sum, r) =>
      sum +
      r.withSkill.tokenUsage.input +
      r.withSkill.tokenUsage.output +
      r.withoutSkill.tokenUsage.input +
      r.withoutSkill.tokenUsage.output,
    0,
  );
  console.log(
    `\n${DIM}Total tokens: ${totalTokens.toLocaleString()} (~$${(totalTokens * 0.000005).toFixed(2)} est.)${RESET}`,
  );
}

/** Write the full report to a JSON file */
export async function writeJsonReport(report: EvalReport): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Strip outputs from the JSON report to keep it manageable
  const slimResults = report.results.map((r) => ({
    ...r,
    withSkill: {
      scores: r.withSkill.scores,
      tokenUsage: r.withSkill.tokenUsage,
    },
    withoutSkill: {
      scores: r.withoutSkill.scores,
      tokenUsage: r.withoutSkill.tokenUsage,
    },
  }));

  const slimReport = { ...report, results: slimResults };
  const filename = `eval-report-${report.runId.replace(/[:.]/g, "-")}.json`;
  const filepath = join(OUTPUT_DIR, filename);

  await Bun.write(filepath, JSON.stringify(slimReport, null, 2));
  console.log(`\n${DIM}Report written to ${filepath}${RESET}`);
  return filepath;
}
