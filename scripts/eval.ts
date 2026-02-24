import { runEval } from "./eval/runner.ts";
import { printTable, printSummary, writeJsonReport } from "./eval/reporter.ts";
import type { EvalOptions } from "./eval/types.ts";

function parseArgs(): EvalOptions {
  const args = process.argv.slice(2);
  return {
    product: args.find((a) => a.startsWith("--product="))?.split("=")[1],
    caseId: args.find((a) => a.startsWith("--case="))?.split("=")[1],
    model:
      args.find((a) => a.startsWith("--model="))?.split("=")[1] ??
      "claude-sonnet-4-5-20250929",
    noCache: args.includes("--no-cache"),
    dryRun: args.includes("--dry-run"),
    concurrency: parseInt(
      args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? "1",
    ),
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  };
}

async function main() {
  const options = parseArgs();

  if (!options.apiKey && !options.dryRun) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required.");
    console.error("Use --dry-run to preview cases without API calls.");
    process.exit(1);
  }

  const report = await runEval(options);

  printTable(report);
  printSummary(report);

  if (report.results.length > 0) {
    await writeJsonReport(report);
  }
}

main().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
