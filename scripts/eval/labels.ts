import { appendFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

const LABELS_PATH = join(process.cwd(), 'scripts', 'eval', 'labels.jsonl');

export interface ReviewLabel {
  caseId: string;
  runId: string;
  ship: boolean;
  who: string;
  reason: string;
  timestamp: string;
  compositeWith: number;
  compositeWithout: number;
}

/** Append a label to the JSONL store. Creates file if missing. */
export async function appendLabel(label: ReviewLabel): Promise<void> {
  await mkdir(dirname(LABELS_PATH), { recursive: true });
  await appendFile(LABELS_PATH, JSON.stringify(label) + '\n');
}

/** Read all labels from the JSONL store. Returns [] if file doesn't exist. */
export async function readLabels(path = LABELS_PATH): Promise<ReviewLabel[]> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return [];
  }

  const labels: ReviewLabel[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      labels.push(JSON.parse(trimmed) as ReviewLabel);
    } catch {
      console.warn(`⚠ Skipping malformed label line: ${trimmed.slice(0, 60)}...`);
    }
  }
  return labels;
}

/** Get all labels for a specific case. */
export async function labelsForCase(caseId: string, path?: string): Promise<ReviewLabel[]> {
  const all = await readLabels(path);
  return all.filter((l) => l.caseId === caseId);
}

/** Get the latest label per case (most recent by timestamp). */
export async function latestLabels(path?: string): Promise<Map<string, ReviewLabel>> {
  const all = await readLabels(path);
  const latest = new Map<string, ReviewLabel>();
  for (const l of all) {
    const existing = latest.get(l.caseId);
    if (!existing || l.timestamp > existing.timestamp) {
      latest.set(l.caseId, l);
    }
  }
  return latest;
}
