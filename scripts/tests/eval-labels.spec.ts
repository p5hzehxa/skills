import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { appendLabel, readLabels, labelsForCase, latestLabels, type ReviewLabel } from '../eval/labels.ts';

const TMP_DIR = join(tmpdir(), 'eval-labels-test');

function makePath() {
  return join(TMP_DIR, `labels-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

function makeLabel(overrides: Partial<ReviewLabel> = {}): ReviewLabel {
  return {
    caseId: 'sso-node-basic',
    runId: '2026-02-26T22:12:32.158Z',
    ship: true,
    who: 'nick',
    reason: 'correct SSO flow',
    timestamp: new Date().toISOString(),
    compositeWith: 98,
    compositeWithout: 95,
    ...overrides,
  };
}

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  // Best-effort cleanup
  try {
    const { readdir } = await import('fs/promises');
    const files = await readdir(TMP_DIR);
    for (const f of files) await unlink(join(TMP_DIR, f));
  } catch {}
});

describe('readLabels', () => {
  it('returns empty array when file does not exist', async () => {
    const labels = await readLabels(join(TMP_DIR, 'nonexistent.jsonl'));
    expect(labels).toEqual([]);
  });

  it('reads labels from JSONL file', async () => {
    const path = makePath();
    const l1 = makeLabel({ caseId: 'a' });
    const l2 = makeLabel({ caseId: 'b' });
    await writeFile(path, JSON.stringify(l1) + '\n' + JSON.stringify(l2) + '\n');

    const labels = await readLabels(path);
    expect(labels).toHaveLength(2);
    expect(labels[0].caseId).toBe('a');
    expect(labels[1].caseId).toBe('b');
  });

  it('skips blank lines', async () => {
    const path = makePath();
    await writeFile(path, JSON.stringify(makeLabel()) + '\n\n\n' + JSON.stringify(makeLabel({ caseId: 'b' })) + '\n');
    const labels = await readLabels(path);
    expect(labels).toHaveLength(2);
  });

  it('skips malformed JSON lines', async () => {
    const path = makePath();
    await writeFile(
      path,
      JSON.stringify(makeLabel()) + '\n{bad json}\n' + JSON.stringify(makeLabel({ caseId: 'b' })) + '\n',
    );
    const labels = await readLabels(path);
    expect(labels).toHaveLength(2);
  });
});

describe('labelsForCase', () => {
  it('filters by caseId', async () => {
    const path = makePath();
    const l1 = makeLabel({ caseId: 'a' });
    const l2 = makeLabel({ caseId: 'b' });
    const l3 = makeLabel({ caseId: 'a', reason: 'second' });
    await writeFile(path, [l1, l2, l3].map((l) => JSON.stringify(l)).join('\n') + '\n');

    const labels = await labelsForCase('a', path);
    expect(labels).toHaveLength(2);
    expect(labels.every((l) => l.caseId === 'a')).toBe(true);
  });
});

describe('latestLabels', () => {
  it('returns most recent label per case', async () => {
    const path = makePath();
    const l1 = makeLabel({ caseId: 'a', timestamp: '2026-01-01T00:00:00Z', reason: 'old' });
    const l2 = makeLabel({ caseId: 'a', timestamp: '2026-02-01T00:00:00Z', reason: 'new' });
    const l3 = makeLabel({ caseId: 'b', timestamp: '2026-01-15T00:00:00Z' });
    await writeFile(path, [l1, l2, l3].map((l) => JSON.stringify(l)).join('\n') + '\n');

    const latest = await latestLabels(path);
    expect(latest.size).toBe(2);
    expect(latest.get('a')!.reason).toBe('new');
    expect(latest.has('b')).toBe(true);
  });

  it('returns empty map when no labels', async () => {
    const latest = await latestLabels(join(TMP_DIR, 'nope.jsonl'));
    expect(latest.size).toBe(0);
  });
});
