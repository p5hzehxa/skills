import { loadTranscript, loadCaseExpected, printDiff } from './eval/diff.ts';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    caseId: args.find((a) => a.startsWith('--case='))?.split('=')[1],
    run: args.find((a) => a.startsWith('--run='))?.split('=')[1],
  };
}

async function main() {
  const { caseId, run } = parseArgs();

  if (!caseId) {
    console.error('Usage: pnpm eval:diff -- --case=<id> [--run=<runId-prefix>]');
    process.exit(1);
  }

  const transcript = await loadTranscript(run);
  const entry = transcript.transcripts.find((t) => t.caseId === caseId);
  if (!entry) {
    const available = transcript.transcripts.map((t) => t.caseId).sort();
    console.error(`Case "${caseId}" not found in transcript.`);
    console.error(`Available: ${available.join(', ')}`);
    process.exit(1);
  }

  const expected = await loadCaseExpected(caseId);
  printDiff(
    caseId,
    entry.withSkill.output,
    entry.withoutSkill.output,
    entry.withSkill.scores.composite,
    entry.withoutSkill.scores.composite,
    expected,
  );
}

main().catch((err) => {
  console.error('Diff failed:', err);
  process.exit(1);
});
