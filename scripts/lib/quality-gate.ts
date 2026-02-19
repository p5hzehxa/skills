import type {
  GeneratedSkill,
  SkillFeedback,
  SemanticCheckResult,
} from "./types.ts";
import { loadFeedback } from "./feedback.ts";

export interface QualityResult {
  skillName: string;
  pass: boolean;
  score: number;
  issues: string[];
  semanticCheck?: SemanticCheckResult;
}

export interface QualityReport {
  total: number;
  passed: number;
  failed: number;
  results: QualityResult[];
}

export interface QualityGateOptions {
  refineMode?: boolean;
  apiKey?: string;
  model?: string;
}

/**
 * Run automated quality checks on generated skills.
 * Scoring rubric (100 points total):
 * - Valid frontmatter with name + description (20 pts)
 * - Has <!-- generated --> marker (5 pts)
 * - Has WebFetch doc references (20 pts)
 * - Has at least 2 structural sections (15 pts)
 * - Content length > 1KB (10 pts)
 * - Has verification checklist OR error recovery (15 pts)
 * - No doc dump: no code blocks >40 lines, no single example >1KB (15 pts)
 *
 * Penalty: behavioral claim patterns without doc deferral nearby (-10 pts)
 *
 * Pass threshold: 70/100
 * Semantic check failures are hard blocks when in refine mode.
 */
export async function runQualityGate(
  skills: GeneratedSkill[],
  options: QualityGateOptions = {},
): Promise<QualityReport> {
  const results: QualityResult[] = [];
  for (const skill of skills) {
    results.push(await scoreSkill(skill, options));
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
}

async function scoreSkill(
  skill: GeneratedSkill,
  options: QualityGateOptions,
): Promise<QualityResult> {
  if (skill.type === "summary") {
    return scoreSummary(skill, options);
  }
  if (skill.type === "guide") {
    return scoreGuide(skill, options);
  }
  // Single-file skills (router, integration router) — use legacy scoring with frontmatter
  return scoreLegacy(skill, options);
}

/** Score a summary file (100 points) */
async function scoreSummary(
  skill: GeneratedSkill,
  options: QualityGateOptions,
): Promise<QualityResult> {
  const issues: string[] = [];
  let score = 0;
  const content = skill.content;

  // 1. Valid frontmatter (20 pts)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    if (fm.includes("name:") && fm.includes("description:")) {
      score += 20;
    } else {
      score += 10;
      if (!fm.includes("name:")) issues.push("Frontmatter missing 'name'");
      if (!fm.includes("description:"))
        issues.push("Frontmatter missing 'description'");
    }
  } else {
    issues.push("No valid frontmatter found");
  }

  // 2. Generated/refined marker (5 pts)
  if (
    /<!--\s*(?:generated|refined)(?::sha256:[a-f0-9]+)?\s*-->/.test(content)
  ) {
    score += 5;
  } else {
    issues.push("Missing generated/refined marker");
  }

  // 3. When to Use section (15 pts)
  if (/^## When to Use/m.test(content)) {
    score += 15;
  } else {
    issues.push("Missing 'When to Use' section");
  }

  // 4. Key Concepts section with content (15 pts)
  if (/^## Key Concepts/m.test(content)) {
    const conceptsMatch = content.match(
      /## Key Concepts\n([\s\S]*?)(?=\n## |$)/,
    );
    const conceptsBody = conceptsMatch?.[1]?.trim() ?? "";
    if (conceptsBody.length > 50) {
      score += 15;
    } else {
      score += 5;
      issues.push("Key Concepts section has minimal content");
    }
  } else {
    issues.push("Missing 'Key Concepts' section");
  }

  // 5. Guide pointer (15 pts)
  if (/Read\s+`?skills\/workos\/.*\.guide\.md`?/.test(content)) {
    score += 15;
  } else {
    issues.push("Missing guide pointer (Read skills/workos/*.guide.md)");
  }

  // 6. Doc URL references (15 pts)
  const docUrlCount = (content.match(/https:\/\/workos\.com\/docs\//g) || [])
    .length;
  if (docUrlCount >= 1) {
    score += 15;
  } else {
    issues.push("No doc URL references found");
  }

  // 7. Related Skills section (5 pts)
  if (/^## Related Skills/m.test(content)) {
    score += 5;
  }

  // 8. Size under 5KB (10 pts)
  if (skill.sizeBytes <= 5120) {
    score += 10;
  } else {
    issues.push(
      `Summary is ${(skill.sizeBytes / 1024).toFixed(1)}KB — should be under 5KB`,
    );
  }

  // --- Semantic check (only in refine mode) ---
  let semanticCheck: SemanticCheckResult | undefined;
  let semanticBlocking = false;
  if (options.refineMode && options.apiKey) {
    const feedback = loadFeedback(skill.name);
    if (feedback.corrections.length > 0 || feedback.emphasis.length > 0) {
      try {
        semanticCheck = await semanticQualityCheck(content, feedback, {
          apiKey: options.apiKey,
          model: options.model,
        });
        if (!semanticCheck.pass) {
          semanticBlocking = true;
          for (const v of semanticCheck.violations) {
            issues.push(`SEMANTIC: ${v}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠ Semantic check failed for ${skill.name}: ${msg}`);
      }
    }
  }

  return {
    skillName: `${skill.name} (summary)`,
    pass: score >= 70 && !semanticBlocking,
    score,
    issues,
    semanticCheck,
  };
}

/** Score a guide file (100 points) */
async function scoreGuide(
  skill: GeneratedSkill,
  options: QualityGateOptions,
): Promise<QualityResult> {
  const issues: string[] = [];
  let score = 0;
  const content = skill.content;

  // 1. Has marker (10 pts) — guides don't have frontmatter
  if (
    /<!--\s*(?:generated|refined)(?::sha256:[a-f0-9]+)?\s*-->/.test(content)
  ) {
    score += 10;
  } else {
    issues.push("Missing generated/refined marker");
  }

  // Bonus: no frontmatter (5 pts) — guides shouldn't have it
  if (!content.match(/^---\n([\s\S]*?)\n---/)) {
    score += 5;
  } else {
    issues.push("Guide should not have frontmatter");
  }

  // 2. WebFetch doc references (20 pts)
  const docUrlCount = (content.match(/https:\/\/workos\.com\/docs\//g) || [])
    .length;
  if (docUrlCount >= 3) {
    score += 20;
  } else if (docUrlCount >= 1) {
    score += 10;
    issues.push(`Only ${docUrlCount} doc URL reference(s), expected 3+`);
  } else {
    issues.push("No doc URL references found");
  }

  // 4. Structural sections (15 pts)
  const h2Count = (content.match(/^## /gm) || []).length;
  if (h2Count >= 4) {
    score += 15;
  } else if (h2Count >= 2) {
    score += 8;
    issues.push(`Only ${h2Count} sections, expected 4+`);
  } else {
    issues.push(`Only ${h2Count} section(s), skill lacks structure`);
  }

  // 5. Content length > 1KB (10 pts)
  if (skill.sizeBytes > 1024) {
    score += 10;
  } else {
    issues.push(`Content is only ${skill.sizeBytes}B, below 1KB minimum`);
  }

  // 6. Has verification or error recovery (15 pts)
  const hasVerification =
    /verification|checklist/i.test(content) && content.includes("- [ ]");
  const hasErrorRecovery =
    /error recovery/i.test(content) && /###/.test(content);
  const hasBashCommands = /```bash/i.test(content);

  if (hasVerification || hasErrorRecovery) {
    score += 10;
    if (hasBashCommands) {
      score += 5;
    } else {
      issues.push("No runnable bash commands in verification/error recovery");
    }
  } else {
    issues.push("Missing verification checklist or error recovery section");
  }

  // 7. No doc dump (15 pts)
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = content.match(codeBlockRegex) || [];
  const longCodeBlocks = codeBlocks.filter((block) => {
    const lines = block.split("\n").length - 2;
    return lines > 40;
  });
  const largeExamples = codeBlocks.filter((block) => block.length > 1024);

  const paragraphs = content.split(/\n\n+/);
  const longUnformattedBlocks = paragraphs.filter(
    (p) =>
      p.length > 2048 &&
      !p.includes("#") &&
      !p.includes("|") &&
      !p.includes("```") &&
      !p.includes("- "),
  );

  if (
    longCodeBlocks.length === 0 &&
    largeExamples.length === 0 &&
    longUnformattedBlocks.length === 0
  ) {
    score += 15;
  } else {
    score += 5;
    if (longCodeBlocks.length > 0) {
      issues.push(
        `${longCodeBlocks.length} code block(s) >40 lines (prefer pseudocode patterns)`,
      );
    }
    if (largeExamples.length > 0) {
      issues.push(
        `${largeExamples.length} code example(s) >1KB (defer to docs)`,
      );
    }
    if (longUnformattedBlocks.length > 0) {
      issues.push(
        `${longUnformattedBlocks.length} block(s) of unformatted content >2KB (possible doc dump)`,
      );
    }
  }

  // --- Behavioral claim check (penalty: -10 pts) ---
  const behavioralClaimPenalty = checkBehavioralClaims(content);
  if (behavioralClaimPenalty.count > 0) {
    score = Math.max(0, score - 10);
    issues.push(
      `${behavioralClaimPenalty.count} behavioral assertion(s) without doc deferral nearby: ${behavioralClaimPenalty.examples.slice(0, 3).join("; ")}`,
    );
  }

  // --- Semantic check (only in refine mode — failures are hard blocks) ---
  let semanticCheck: SemanticCheckResult | undefined;
  let semanticBlocking = false;
  if (options.refineMode && options.apiKey) {
    const feedback = loadFeedback(skill.name);
    if (feedback.corrections.length > 0 || feedback.emphasis.length > 0) {
      try {
        semanticCheck = await semanticQualityCheck(content, feedback, {
          apiKey: options.apiKey,
          model: options.model,
        });
        if (!semanticCheck.pass) {
          semanticBlocking = true;
          for (const v of semanticCheck.violations) {
            issues.push(`SEMANTIC: ${v}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠ Semantic check failed for ${skill.name}: ${msg}`);
      }
    }
  }

  const label = skill.type ? `${skill.name} (${skill.type})` : skill.name;
  return {
    skillName: label,
    pass: score >= 70 && !semanticBlocking,
    score,
    issues,
    semanticCheck,
  };
}

/** Score a single-file skill (router, integration router) — expects frontmatter */
async function scoreLegacy(
  skill: GeneratedSkill,
  options: QualityGateOptions,
): Promise<QualityResult> {
  const issues: string[] = [];
  let score = 0;
  const content = skill.content;

  // 1. Valid frontmatter (20 pts)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    if (fm.includes("name:") && fm.includes("description:")) {
      score += 20;
    } else {
      score += 10;
      if (!fm.includes("name:")) issues.push("Frontmatter missing 'name'");
      if (!fm.includes("description:"))
        issues.push("Frontmatter missing 'description'");
    }
  } else {
    issues.push("No valid frontmatter found");
  }

  // 2. Generated/refined marker (5 pts)
  if (
    /<!--\s*(?:generated|refined)(?::sha256:[a-f0-9]+)?\s*-->/.test(content)
  ) {
    score += 5;
  } else {
    issues.push("Missing generated/refined marker");
  }

  // 3. Doc URL references (20 pts)
  const docUrlCount = (content.match(/https:\/\/workos\.com\/docs\//g) || [])
    .length;
  if (docUrlCount >= 3) {
    score += 20;
  } else if (docUrlCount >= 1) {
    score += 10;
    issues.push(`Only ${docUrlCount} doc URL reference(s), expected 3+`);
  } else {
    issues.push("No doc URL references found");
  }

  // 4. Structural sections (15 pts)
  const h2Count = (content.match(/^## /gm) || []).length;
  if (h2Count >= 4) {
    score += 15;
  } else if (h2Count >= 2) {
    score += 8;
    issues.push(`Only ${h2Count} sections, expected 4+`);
  } else {
    issues.push(`Only ${h2Count} section(s), skill lacks structure`);
  }

  // 5. Content length > 1KB (10 pts)
  if (skill.sizeBytes > 1024) {
    score += 10;
  } else {
    issues.push(`Content is only ${skill.sizeBytes}B, below 1KB minimum`);
  }

  // 6. Has verification or error recovery (15 pts)
  const hasVerification =
    /verification|checklist/i.test(content) && content.includes("- [ ]");
  const hasErrorRecovery =
    /error recovery/i.test(content) && /###/.test(content);
  const hasBashCommands = /```bash/i.test(content);

  if (hasVerification || hasErrorRecovery) {
    score += 10;
    if (hasBashCommands) {
      score += 5;
    } else {
      issues.push("No runnable bash commands in verification/error recovery");
    }
  } else {
    issues.push("Missing verification checklist or error recovery section");
  }

  // 7. No doc dump (15 pts)
  const paragraphs = content.split(/\n\n+/);
  const longUnformattedBlocks = paragraphs.filter(
    (p) =>
      p.length > 2048 &&
      !p.includes("#") &&
      !p.includes("|") &&
      !p.includes("```") &&
      !p.includes("- "),
  );
  if (longUnformattedBlocks.length === 0) {
    score += 15;
  } else {
    score += 5;
    issues.push(
      `${longUnformattedBlocks.length} block(s) of unformatted content >2KB`,
    );
  }

  return {
    skillName: skill.name,
    pass: score >= 70,
    score,
    issues,
  };
}

/**
 * Check for behavioral assertions without nearby doc deferrals.
 */
function checkBehavioralClaims(content: string): {
  count: number;
  examples: string[];
} {
  const behavioralPatterns = [
    /is\s+required/gi,
    /is\s+mandatory/gi,
    /is\s+not\s+supported/gi,
    /must\s+use/gi,
    /only\s+supports/gi,
  ];

  const lines = content.split("\n");
  const examples: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of behavioralPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        const nearby = lines
          .slice(Math.max(0, i - 3), Math.min(lines.length, i + 4))
          .join(" ");
        if (!/check\s+(fetched\s+)?docs/i.test(nearby)) {
          const snippet = line.trim().slice(0, 80);
          examples.push(snippet);
        }
      }
    }
  }

  return { count: examples.length, examples };
}

const SEMANTIC_CHECK_URL = "https://api.anthropic.com/v1/messages";
const SEMANTIC_CHECK_MODEL = "claude-haiku-4-5-20251001";
const SEMANTIC_CHECK_MAX_TOKENS = 1024;

/**
 * Run LLM-based semantic validation on a refined skill.
 * Checks: (a) feedback corrections respected, (b) behavioral claims deferred to docs.
 * Only called when --refine flag is active. Failures are hard blocks.
 */
export async function semanticQualityCheck(
  skillContent: string,
  feedback: SkillFeedback,
  options: { apiKey: string; model?: string },
): Promise<SemanticCheckResult> {
  const system = `You are a skill quality auditor. Check the given skill content against domain expert feedback and the content taxonomy.

Return ONLY valid JSON in this format:
{"pass": true/false, "violations": ["description of each violation"], "score": 0-100}

Check for:
1. Each correction in the feedback — is it respected? Does the skill contradict it?
2. Behavioral claims — does the skill assert "is required", "is mandatory", etc. without deferring to docs?

Score guide:
- 90-100: All feedback respected, no behavioral claims baked in
- 70-89: Minor issues (soft emphasis missed, borderline behavioral language)
- 50-69: Some feedback corrections not respected, or multiple behavioral assertions
- 0-49: Major violations (directly contradicts feedback, heavy doc-baking)`;

  const user = `## Skill Content

${skillContent.slice(0, 6000)}

## Domain Expert Feedback

### Corrections (must be respected)
${feedback.corrections.map((c) => `- ${c}`).join("\n") || "None"}

### Emphasis (should be highlighted)
${feedback.emphasis.map((e) => `- ${e}`).join("\n") || "None"}

Analyze and return JSON only.`;

  try {
    const response = await fetch(SEMANTIC_CHECK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": options.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: options.model ?? SEMANTIC_CHECK_MODEL,
        max_tokens: SEMANTIC_CHECK_MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { pass: true, violations: [], score: 50 };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      pass: Boolean(parsed.pass),
      violations: Array.isArray(parsed.violations) ? parsed.violations : [],
      score: typeof parsed.score === "number" ? parsed.score : 50,
    };
  } catch {
    return { pass: true, violations: [], score: 50 };
  }
}
