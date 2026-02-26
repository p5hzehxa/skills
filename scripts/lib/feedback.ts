import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { SkillFeedback } from './types.ts';

/**
 * Load feedback from plugins/workos/skills/workos/references/{skillName}.feedback.md.
 * Returns empty feedback if no file exists.
 */
export function loadFeedback(skillName: string): SkillFeedback {
  const feedbackPath = join(
    process.cwd(),
    'plugins',
    'workos',
    'skills',
    'workos',
    'references',
    `${skillName}.feedback.md`,
  );

  if (!existsSync(feedbackPath)) {
    return { corrections: [], emphasis: [] };
  }

  try {
    const raw = readFileSync(feedbackPath, 'utf8');
    if (!raw.trim()) return { corrections: [], emphasis: [] };

    return parseFeedbackMarkdown(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ⚠ Failed to parse ${feedbackPath}: ${msg}`);
    return { corrections: [], emphasis: [] };
  }
}

/**
 * Parse markdown content into SkillFeedback.
 * Extracts list items under ## Corrections and ## Emphasis headings.
 */
export function parseFeedbackMarkdown(raw: string): SkillFeedback {
  const corrections: string[] = [];
  const emphasis: string[] = [];

  let currentSection: 'corrections' | 'emphasis' | null = null;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    // Detect section headings
    if (/^##\s+corrections/i.test(trimmed)) {
      currentSection = 'corrections';
      continue;
    }
    if (/^##\s+emphasis/i.test(trimmed)) {
      currentSection = 'emphasis';
      continue;
    }
    // Any other heading resets the section
    if (/^##?\s+/.test(trimmed) && currentSection !== null) {
      currentSection = null;
      continue;
    }

    // Extract list items (- or *)
    if (currentSection && /^[-*]\s+/.test(trimmed)) {
      const item = trimmed.replace(/^[-*]\s+/, '').trim();
      if (item) {
        if (currentSection === 'corrections') {
          corrections.push(item);
        } else {
          emphasis.push(item);
        }
      }
      continue;
    }

    // Continuation lines (indented text after a list item) — append to last item
    if (currentSection && trimmed && corrections.length + emphasis.length > 0) {
      const target = currentSection === 'corrections' ? corrections : emphasis;
      if (target.length > 0) {
        target[target.length - 1] += ' ' + trimmed;
      }
    }
  }

  return { corrections, emphasis };
}

/**
 * Format feedback as constraint text for refiner prompts.
 * Returns empty string if no feedback exists.
 */
export function formatFeedbackForPrompt(feedback: SkillFeedback): string {
  if (feedback.corrections.length === 0 && feedback.emphasis.length === 0) {
    return '';
  }

  const lines = [
    '\n## Domain Expert Feedback (CRITICAL)\n',
    'The following feedback comes from domain experts who reviewed previous versions of this skill.\n',
  ];

  if (feedback.corrections.length > 0) {
    lines.push('### Corrections (MUST respect)\n');
    for (const c of feedback.corrections) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  if (feedback.emphasis.length > 0) {
    lines.push('### Emphasis (SHOULD highlight)\n');
    for (const e of feedback.emphasis) {
      lines.push(`- ${e}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
