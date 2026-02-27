import { runEval } from './eval/runner.ts';
import {
  printTable,
  printSummary,
  writeJsonReport,
  writeTranscripts,
  printLanguageBreakdown,
  printErrorReductions,
  checkGates,
} from './eval/reporter.ts';
import { rankByRisk, printTriage, writeTriageReport } from './eval/triage.ts';
import type { EvalOptions } from './eval/types.ts';

function parseArgs(): EvalOptions {
  const args = process.argv.slice(2);
  const rawSamples = args.find((a) => a.startsWith('--samples='))?.split('=')[1];
  const parsedSamples = rawSamples ? parseInt(rawSamples) : 1;
  const samples = Math.max(1, parsedSamples || 1);
  if (rawSamples && samples !== parsedSamples) {
    console.warn(`⚠ Invalid --samples=${rawSamples}, using --samples=${samples}`);
  }
  return {
    product: args.find((a) => a.startsWith('--product='))?.split('=')[1],
    caseId: args.find((a) => a.startsWith('--case='))?.split('=')[1],
    model: args.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'claude-sonnet-4-5-20250929',
    noCache: args.includes('--no-cache'),
    dryRun: args.includes('--dry-run'),
    concurrency: parseInt(args.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? '3'),
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    lang: args.find((a) => a.startsWith('--lang='))?.split('=')[1],
    reportFormat: args.find((a) => a.startsWith('--report='))?.split('=')[1] ?? 'both',
    failOnRegression: args.includes('--fail-on-regression'),
    samples,
    saveAllSamples: args.includes('--save-all-samples'),
  };
}

async function main() {
  const options = parseArgs();

  if (!options.apiKey && !options.dryRun) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
    console.error('Use --dry-run to preview cases without API calls.');
    process.exit(1);
  }

  const report = await runEval(options);

  const fmt = options.reportFormat ?? 'both';

  if (fmt === 'table' || fmt === 'both') {
    printTable(report);
    printSummary(report);
    printLanguageBreakdown(report);
    printErrorReductions(report);
  }

  // Triage report
  if (report.results.length > 0) {
    const triageCases = rankByRisk(report.results);
    if (fmt === 'table' || fmt === 'both') {
      printTriage(triageCases);
    }
    if (fmt === 'json' || fmt === 'both') {
      await writeTriageReport(triageCases, report.runId);
    }
  }

  if (report.results.length > 0 && (fmt === 'json' || fmt === 'both')) {
    await writeJsonReport(report);
    await writeTranscripts(report);
  }

  if (options.failOnRegression && report.results.length > 0) {
    const gateResult = checkGates(report);
    console.log('\n  Regression Gates:');
    if (gateResult.passed) {
      console.log('    ✓ All gates passed');
    } else {
      for (const f of gateResult.failures) {
        console.log(`    ✗ ${f}`);
      }
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
