import { readdirSync } from "fs";
import { join } from "path";
import type { GeneratedSkill } from "./types.ts";
import { parseMarker } from "./hasher.ts";
import { loadFeedback, formatFeedbackForPrompt } from "./feedback.ts";

/** Read valid skill names from disk to prevent phantom references */
function getValidSkillNames(): string[] {
  try {
    const skillsDir = join(process.cwd(), "skills");
    return readdirSync(skillsDir).filter((d) => d.startsWith("workos-"));
  } catch {
    return [];
  }
}

/** Content taxonomy block shared by all refiner prompts */
function getContentTaxonomyBlock(): string {
  return `
## Content Taxonomy (CRITICAL)

Your output MUST follow this taxonomy. Violations will be caught by the quality gate.

### SAFE to include (structural vocabulary + architectural decisions)
- Concept names: "organization", "connection", "directory", "role slug"
- ID prefixes and env var names: \`sk_\`, \`WORKOS_API_KEY\`
- Event type naming conventions: \`{domain}.{resource}.{action}\`
- Dashboard navigation paths
- Architectural patterns: "use upsert", "return 200 immediately", "verify signature before processing"
- Decision trees for choosing between approaches
- Trap warnings: things agents will get wrong without explicit guidance
- Verification commands: bash one-liners to confirm setup

### MUST DEFER to docs (behavioral claims + API surface details)
- Behavioral assertions: "X is required", "Y is not supported", "Z is mandatory"
  → Instead write: "Check fetched docs for [specific question]"
- Exact SDK method signatures (vary by language/version)
  → Instead write: "Use the SDK method for [operation] — check fetched docs for exact signature"
- Complete request/response schemas
- Error code tables and rate limits
- Complete code implementations
  → Instead provide pseudocode showing the PATTERN, not exact code
- Any claim with "always", "never", "only", "must" about API behavior

### The test: "Would this sentence become wrong if the docs changed?"
If yes → defer to docs. If no (it's a pattern, decision, or structural fact) → safe to include.`;
}

/** Attribution + anti-hallucination block shared by all refiner prompts */
function getAttributionBlock(): string {
  const validSkills = getValidSkillNames();
  return `

## Source Attribution (CRITICAL)

- ONLY make factual claims that are directly supported by the source documentation provided in the scaffold.
- Do NOT infer, extrapolate, or assume capabilities not explicitly stated in the docs.
- For behavioral claims ("is required", "is mandatory", "is not supported"), defer to fetched docs instead of baking them in.
- If the source docs are ambiguous about a capability, write "Check fetched docs for [specific question]" and provide the URL — do NOT guess.
- NEVER introduce SDK method names, API endpoints, or configuration options that are not in the source docs.

## SDK Method Names (CRITICAL)

- The scaffold was generated from REAL documentation. If it contains SDK method names with parameter signatures, PRESERVE them exactly — they came from the docs.
- If YOU are unsure whether a method exists, check if it appears in the scaffold. If it does, trust it.
- NEVER invent NEW SDK method names beyond what the scaffold provides. If you need a method the scaffold doesn't show, write a WebFetch instruction instead.
- NEVER write "check docs for exact method name" or "exact method name in fetched docs" — this is useless to an agent. Either provide the method or provide a WebFetch URL.
- For migration skills: distinguish between SOURCE system limitations (e.g., "Cognito doesn't export hashes") and WorkOS limitations (e.g., "WorkOS doesn't support X"). Do NOT conflate them.

## Thin APIs / Generic Guides

- Some API domains have very few endpoints (e.g., Widgets API = just token generation). This is ACCEPTABLE — do not pad thin APIs with invented content. Instead, add usage context and integration patterns.
- Some migration guides are intentionally generic (e.g., "other services"). Compensate by adding MORE decision trees and edge case branches, not by inventing provider-specific content.

## Related Skills References (CRITICAL)

Only reference these skills in "Related Skills" sections — these are the ONLY valid skill names:
${validSkills.map((s) => `- ${s}`).join("\n")}

Do NOT invent skill names. If no related skill exists for a topic, omit it.`;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 8192;

/** Delay between API calls to avoid rate limiting */
const RATE_LIMIT_DELAY_MS = 1000;

export interface RefineOptions {
  apiKey: string;
  model?: string;
  /** The gold standard skill content (e.g., workos-authkit-nextjs SKILL.md) */
  goldStandard: string;
}

/**
 * Refine a generated skill scaffold by calling the Anthropic API
 * to transform doc prose into procedural agent instructions.
 *
 * Preserves: frontmatter, `<!-- generated -->` marker, doc URLs
 * Rewrites: implementation guide, verification, error recovery, when to use
 */
export async function refineSkill(
  skill: GeneratedSkill,
  options: RefineOptions,
): Promise<GeneratedSkill> {
  const { frontmatter, body } = splitFrontmatter(skill.content);
  const docUrls = extractDocUrls(body);
  const skillName = skill.name;

  // Extract source hash from existing marker (preserves through refinement)
  const existingMarker = parseMarker(skill.content);
  const sourceHash = skill.sourceHash ?? existingMarker.hash;

  const isSummary = skill.type === "summary";
  const isRouter = skillName === "workos";
  const isApiRef = skillName.startsWith("workos-api-");
  const prompt = isSummary
    ? buildSummaryRefinePrompt(skillName, frontmatter, body)
    : isRouter
      ? buildRouterRefinePrompt(skillName, frontmatter, body)
      : isApiRef
        ? buildApiRefRefinePrompt(skillName, frontmatter, body, docUrls)
        : buildRefinePrompt(
            skillName,
            frontmatter,
            body,
            docUrls,
            options.goldStandard,
          );

  const refined = await callAnthropic(prompt, options);
  // Guides have no frontmatter — use ensureGuideMarkers for them
  const content =
    skill.type === "guide"
      ? ensureGuideMarkers(refined, sourceHash)
      : ensureMarkers(frontmatter, refined, sourceHash);

  return {
    ...skill,
    content,
    sizeBytes: Buffer.byteLength(content, "utf8"),
  };
}

/** Build the system + user prompt for summary skill refinement */
function buildSummaryRefinePrompt(
  skillName: string,
  frontmatter: string,
  body: string,
): { system: string; user: string } {
  const feedback = loadFeedback(skillName);
  const feedbackContext = formatFeedbackForPrompt(feedback);

  const system = `You are a skill refinement agent specializing in SUMMARY skills. A summary is a ROUTING DOCUMENT — it helps an agent decide whether to load the full implementation guide. It is NOT a mini-guide.

## Summary structure (5 sections, strict)

1. **"When to Use"** — 2-3 sentences. What problem does this feature solve? When should an agent reach for this skill vs another?

2. **"Documentation"** — the doc URL list. PRESERVE EXACTLY as-is. Do not add or remove URLs.

3. **"Key Vocabulary"** — a SHORT bullet list of structural terms UNIQUE TO THIS FEATURE. ONLY these are allowed:
   - Entity names with ID prefixes (e.g., "Organization \`org_\`", "Connection \`conn_\`")
   - Feature-specific event type patterns (e.g., \`dsync.user.created\`)
   - Maximum 10 bullet points. No sub-lists.
   - Do NOT include: \`WORKOS_API_KEY\`, \`WORKOS_CLIENT_ID\`, or other env vars shared across all WorkOS skills
   - Do NOT include: generic protocol concepts (OAuth state, redirect_uri, CNAME records)
   - Do NOT include: behavioral claims about what features do or how they work

4. **"Implementation Guide"** — the guide pointer. PRESERVE EXACTLY as-is. Do not add content around it.

5. **"Related Skills"** — PRESERVE EXACTLY as-is.

## HARD RULES

- **NO verification commands, bash blocks, or curl examples** — those belong in the guide
- **NO SDK method names** — those change by language/version
- **NO behavioral claims** ("X is required", "Y is mandatory", "Z is not supported")
- **NO procedural steps, numbered flows, or "how to" instructions**
- **NO decision trees** — the guide has those
- **NO security instructions** ("Do NOT store...", "Always verify...")
- **NO "Common Traps" or "Trap Warnings" sections** — those belong in the guide
- **Target size: 500-1000 bytes** after frontmatter. If your output exceeds 1.5KB, you wrote too much.

The summary's job is DONE when an agent can answer: "Is this the right skill for my task?" and "What doc URLs should I fetch?"
${getAttributionBlock()}${feedbackContext}`;

  const user = `Refine this summary for "${skillName}". Write a tight "When to Use" (2-3 sentences) and a "Key Vocabulary" list (max 10 bullets of entity names and ID prefixes only). PRESERVE the "Documentation", "Implementation Guide", and "Related Skills" sections EXACTLY — do not remove or modify them.

<scaffold>
${body}
</scaffold>

Output ONLY the refined skill body markdown. No frontmatter, no \`<!-- generated -->\` marker, no wrapping code fences.`;

  return { system, user };
}

/** Build the system + user prompt for router skill refinement */
function buildRouterRefinePrompt(
  skillName: string,
  frontmatter: string,
  body: string,
): { system: string; user: string } {
  const feedback = loadFeedback(skillName);
  const feedbackContext = formatFeedbackForPrompt(feedback);

  const system = `You are a skill refinement agent specializing in ROUTING skills. A router skill is NOT an implementation guide — it is a decision-tree dispatcher that maps user intent to the correct specialized skill.

## What makes a great router skill

1. **Precise disambiguation** — when two skills could match, explicit rules say which one wins
2. **Priority-ordered detection** — framework/technology detection checks most-specific first
3. **Clear fallback chain** — what to do when no skill matches, step by step
4. **Imperative voice** — "Load workos-sso" not "The workos-sso skill can be loaded"
5. **No implementation details** — the router dispatches, it does NOT teach how to implement features
6. **Compact lookup table** — easy to scan, consistent formatting
7. **Edge case coverage** — what if the user mentions multiple features? What if their framework can't be detected?

## Rules for router refinement

1. Output ONLY the skill body (everything after frontmatter). Do NOT include frontmatter or the \`<!-- generated -->\` marker.
2. PRESERVE the full Topic → Skill Map table exactly as-is (skill names and doc references must not change).
3. IMPROVE disambiguation rules — add clarity on overlapping intents and priority ordering.
4. IMPROVE the framework detection section — ensure priority order is explicit and handles ambiguous cases.
5. IMPROVE the decision flow — make it a clear, unambiguous dispatch tree.
6. ADD edge case handling (multiple features, unknown framework, vague requests).
7. KEEP the "If No Skill Matches" fallback with llms.txt.
8. Do NOT add implementation steps, verification commands, or code examples — this is a router, not a tutorial.
${getContentTaxonomyBlock()}
${getAttributionBlock()}${feedbackContext}`;

  const user = `Refine this router skill "${skillName}". Improve its disambiguation, detection priority, and decision flow while preserving the skill lookup table exactly.

<scaffold>
${body}
</scaffold>

Output ONLY the refined skill body markdown. No frontmatter, no \`<!-- generated -->\` marker, no wrapping code fences.`;

  return { system, user };
}

/** Build the system + user prompt for API reference skill refinement */
function buildApiRefRefinePrompt(
  skillName: string,
  frontmatter: string,
  body: string,
  docUrls: string[],
): { system: string; user: string } {
  const feedback = loadFeedback(skillName);
  const feedbackContext = formatFeedbackForPrompt(feedback);

  const system = `You are a skill refinement agent specializing in API REFERENCE skills. An API reference skill teaches an agent how to use specific REST API endpoints — it is NOT a feature overview or tutorial.

## What makes a great API reference skill

1. **WebFetch first** — Step 1 always fetches the latest API docs at runtime. The skill does NOT bake in API details that may change.
2. **Endpoint catalog** — lists available endpoints (method + path) so the agent knows what's possible. Endpoint catalogs are structural — keep them.
3. **Authentication setup** — how to authenticate API calls (API key header, bearer token, etc.)
4. **Operation decision tree** — which endpoint to use for which task (create vs update vs upsert). Show the decision tree, not the full schema.
5. **Error code mapping** — map HTTP status codes to specific causes and fixes (not generic "check API key")
6. **Pagination handling** — if the API is paginated, show the pattern (cursor, offset, etc.)
7. **Runnable verification** — curl commands or SDK calls to test the integration works
8. **Rate limit guidance** — mention limits and retry strategies if applicable
9. **Imperative voice** — "Call GET /users" not "The GET /users endpoint can be called"

## Rules for API reference refinement

1. Output ONLY the skill body (everything after frontmatter). Do NOT include frontmatter or the \`<!-- generated -->\` marker.
2. KEEP the "Step 1: Fetch Documentation" section with these exact doc URLs: ${docUrls.map((u) => `\n   - ${u}`).join("")}
3. PRESERVE endpoint tables (method + path + purpose) — these are structural
4. DEFER request/response schemas to fetched docs — these are behavioral
5. ADD a clear operation decision tree (CRUD mapping)
6. ADD specific error codes with causes and fixes (not generic retry logic)
7. ADD runnable curl or SDK verification commands
8. ADD pagination pattern if the API supports listing
9. REMOVE marketing prose, feature descriptions, and baked-in content that should come from docs
10. Replace complete code examples with pseudocode patterns. Show WHAT to do, not exact HOW
11. Include a "Related Skills" section linking to the corresponding feature skill
${getContentTaxonomyBlock()}
${getAttributionBlock()}${feedbackContext}`;

  const user = `Refine this API reference skill "${skillName}". Transform it into a practical API usage guide with endpoint patterns, error handling, and verification commands.

<scaffold>
${body}
</scaffold>

Output ONLY the refined skill body markdown. No frontmatter, no \`<!-- generated -->\` marker, no wrapping code fences.`;

  return { system, user };
}

/** Build the system + user prompt for refinement */
function buildRefinePrompt(
  skillName: string,
  frontmatter: string,
  body: string,
  docUrls: string[],
  goldStandard: string,
): { system: string; user: string } {
  const feedback = loadFeedback(skillName);
  const feedbackContext = formatFeedbackForPrompt(feedback);

  const system = `You are a skill refinement agent. Your job is to transform auto-generated skill scaffolds into guides that add value BEYOND what the docs provide.

The agent will WebFetch the docs at runtime. Your guide should NOT restate what the docs say — instead, provide what docs DON'T:
- **Decision trees** that synthesize across multiple doc pages
- **Trap warnings** from domain expert feedback (things agents get wrong)
- **Verification commands** to confirm setup worked
- **Error recovery** for issues not covered in docs (real-world integration problems)

## What makes a great guide

Study this gold standard:

<gold-standard>
${goldStandard}
</gold-standard>

Key patterns:
1. **Step 1 is always "Fetch Documentation"** — the docs are the source of truth
2. **Decision trees** for ambiguous choices the docs don't resolve
3. **Verification commands** — runnable bash one-liners with pass/fail
4. **Error recovery** — specific errors mapped to specific fixes with root causes
5. **Imperative voice** — "Detect package manager" not "The package manager can be detected"
6. **No restating docs** — if the docs explain it clearly, don't repeat it. Add a "Check fetched docs for..." pointer instead.

## Rules

1. Output ONLY the skill body. No frontmatter, no \`<!-- generated -->\` marker.
2. KEEP Step 1 with these doc URLs: ${docUrls.map((u) => `\n   - ${u}`).join("")}
3. For topics the docs cover well: write "Check fetched docs for [specific topic]" — do NOT restate.
4. For topics that span multiple doc pages or are confusing: ADD a decision tree.
5. ADD a verification checklist with RUNNABLE bash commands.
6. ADD error recovery with specific errors → specific fixes.
7. REMOVE marketing prose, feature descriptions, and baked-in doc content.
8. NO SDK method names — they vary by language. Use "SDK method for [operation]" instead.
9. NO behavioral claims ("X is required", "Y is mandatory") — defer to fetched docs.
10. Aim for 80-150 lines. If you're over 200 lines, you're restating docs.
${getContentTaxonomyBlock()}
${getAttributionBlock()}${feedbackContext}`;

  const user = `Refine this skill scaffold for "${skillName}". Transform the doc prose into procedural agent instructions matching the gold standard quality.

<scaffold>
${body}
</scaffold>

Output ONLY the refined skill body markdown. No frontmatter, no \`<!-- generated -->\` marker, no wrapping code fences.`;

  return { system, user };
}

/** Call the Anthropic Messages API */
async function callAnthropic(
  prompt: { system: string; user: string },
  options: RefineOptions,
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  if (!text.trim()) {
    throw new Error("Anthropic API returned empty response");
  }

  return text.trim();
}

/** Split frontmatter from body */
function splitFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  const match = content.match(/^(---\n[\s\S]*?\n---)\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: "", body: content };
  }
  return { frontmatter: match[1], body: match[2].trim() };
}

/** Extract doc URLs from the skill body */
function extractDocUrls(body: string): string[] {
  const urls: string[] = [];
  const re = /- (https:\/\/workos\.com\/docs\/[^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/** Reassemble frontmatter + marker + refined body */
function ensureMarkers(
  frontmatter: string,
  body: string,
  sourceHash: string | null,
): string {
  // Strip any frontmatter the LLM may have included
  let cleanBody = body;
  if (cleanBody.startsWith("---")) {
    const endIdx = cleanBody.indexOf("---", 3);
    if (endIdx !== -1) {
      cleanBody = cleanBody.slice(endIdx + 3).trim();
    }
  }

  // Strip any marker the LLM included (generated or refined, with or without hash)
  cleanBody = cleanBody
    .replace(
      /<!--\s*(?:generated|refined)(?::sha256:[a-f0-9]+)?\s*-->\s*\n?/,
      "",
    )
    .trim();

  const marker = sourceHash
    ? `<!-- refined:sha256:${sourceHash} -->`
    : "<!-- generated -->";

  return `${frontmatter}\n\n${marker}\n\n${cleanBody}\n`;
}

/** Reassemble marker + refined body for guide files (no frontmatter) */
function ensureGuideMarkers(body: string, sourceHash: string | null): string {
  // Strip any frontmatter the LLM may have included
  let cleanBody = body;
  if (cleanBody.startsWith("---")) {
    const endIdx = cleanBody.indexOf("---", 3);
    if (endIdx !== -1) {
      cleanBody = cleanBody.slice(endIdx + 3).trim();
    }
  }

  // Strip any marker the LLM included
  cleanBody = cleanBody
    .replace(
      /<!--\s*(?:generated|refined)(?::sha256:[a-f0-9]+)?\s*-->\s*\n?/,
      "",
    )
    .trim();

  const marker = sourceHash
    ? `<!-- refined:sha256:${sourceHash} -->`
    : "<!-- generated -->";

  return `${marker}\n\n${cleanBody}\n`;
}

/** Sleep for rate limiting between API calls */
export function rateLimitDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
}
