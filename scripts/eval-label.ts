import { join } from 'path';
import { readdir, readFile } from 'fs/promises';
import { appendLabel } from './eval/labels.ts';

const OUTPUT_DIR = join(process.cwd(), 'scripts', 'output');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    caseId: args.find((a) => a.startsWith('--case='))?.split('=')[1],
    ship: args.find((a) => a.startsWith('--ship='))?.split('=')[1],
    who: args.find((a) => a.startsWith('--who='))?.split('=')[1],
    reason: args.find((a) => a.startsWith('--reason='))?.split('=')[1],
  };
}

async function findLatestReport(): Promise<{
  runId: string;
  results: {
    caseId: string;
    withSkill: { scores: { composite: number } };
    withoutSkill: { scores: { composite: number } };
  }[];
} | null> {
  try {
    const files = await readdir(OUTPUT_DIR);
    const reports = files
      .filter((f) => f.startsWith('eval-report-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (reports.length === 0) return null;
    const raw = await readFile(join(OUTPUT_DIR, reports[0]), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  const { caseId, ship, who, reason } = parseArgs();

  if (!caseId || !ship || !who || !reason) {
    console.error('Usage: pnpm eval:label -- --case=<id> --ship=yes|no --who=<name> --reason="<text>"');
    process.exit(1);
  }

  if (ship !== 'yes' && ship !== 'no') {
    console.error('--ship must be "yes" or "no"');
    process.exit(1);
  }

  const report = await findLatestReport();
  if (!report) {
    console.error('No eval report found. Run an eval first: pnpm eval -- --no-cache');
    process.exit(1);
  }

  const caseResult = report.results.find((r) => r.caseId === caseId);
  if (!caseResult) {
    const available = report.results.map((r) => r.caseId).sort();
    console.error(`Case "${caseId}" not found in latest report.`);
    console.error(`Available: ${available.join(', ')}`);
    process.exit(1);
  }

  await appendLabel({
    caseId,
    runId: report.runId,
    ship: ship === 'yes',
    who,
    reason,
    timestamp: new Date().toISOString(),
    compositeWith: caseResult.withSkill.scores.composite,
    compositeWithout: caseResult.withoutSkill.scores.composite,
  });

  console.log(`Label added: ${caseId} → ${ship === 'yes' ? 'ship' : 'no-ship'} (by ${who})`);
}

main().catch((err) => {
  console.error('Label failed:', err);
  process.exit(1);
});
