import { join } from 'path';
import { readdir, readFile } from 'fs/promises';
import { readLabels } from './eval/labels.ts';
import { computeCalibration, printCalibration } from './eval/calibrate.ts';
import type { EvalResult } from './eval/types.ts';

const OUTPUT_DIR = join(process.cwd(), 'scripts', 'output');

async function findLatestReport(): Promise<{ results: EvalResult[] } | null> {
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
  const labels = await readLabels();
  if (labels.length === 0) {
    console.log('No labels found. Use `pnpm eval:label` to add human judgments.');
    return;
  }

  const report = await findLatestReport();
  if (!report) {
    console.error('No eval report found. Run an eval first: pnpm eval -- --no-cache');
    process.exit(1);
  }

  const cal = computeCalibration(labels, report.results);
  printCalibration(cal);
}

main().catch((err) => {
  console.error('Calibrate failed:', err);
  process.exit(1);
});
