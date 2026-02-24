import { join } from "path";
import { readdirSync, readFileSync } from "fs";
import { parse } from "yaml";
import { HAND_CRAFTED_SKILLS } from "../lib/config.ts";
import { generateCode } from "./api.ts";
import { getCacheKey, readCache, writeCache } from "./cache.ts";
import { scoreOutput, categorizeErrors } from "./scorer.ts";
import type {
  EvalCase,
  EvalOptions,
  EvalReport,
  EvalResult,
  ProductSummary,
  ErrorCategory,
} from "./types.ts";

const CASES_DIR = join(process.cwd(), "scripts", "eval", "cases");
const PLUGIN_DIR = join(process.cwd(), "plugins", "workos", "skills");
const REFS_DIR = join(PLUGIN_DIR, "workos", "references");

/** Load and parse all YAML test cases, optionally filtered */
export function loadCases(
  casesDir = CASES_DIR,
  filter?: { product?: string; caseId?: string },
): EvalCase[] {
  const files = readdirSync(casesDir).filter(
    (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
  );

  const cases: EvalCase[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(casesDir, file), "utf8");
      const parsed = parse(raw) as EvalCase[];
      if (Array.isArray(parsed)) {
        cases.push(...parsed);
      }
    } catch (err) {
      console.error(`⚠ Failed to parse ${file}:`, (err as Error).message);
    }
  }

  return cases.filter((c) => {
    if (filter?.product && c.product !== filter.product) return false;
    if (filter?.caseId && c.id !== filter.caseId) return false;
    return true;
  });
}

/** Load skill content from disk. Concatenates summary + guide for generated skills. */
export function loadSkillContent(skillName: string): string {
  const isHandCrafted = (HAND_CRAFTED_SKILLS as readonly string[]).includes(
    skillName,
  );

  if (isHandCrafted) {
    return readFileSync(join(PLUGIN_DIR, skillName, "SKILL.md"), "utf8");
  }

  // Generated: summary + guide
  const summaryPath = join(REFS_DIR, `${skillName}.md`);
  const guidePath = join(REFS_DIR, `${skillName}.guide.md`);

  const parts: string[] = [];

  try {
    parts.push(readFileSync(summaryPath, "utf8"));
  } catch {
    // Summary may not exist for some skills
  }

  try {
    parts.push(readFileSync(guidePath, "utf8"));
  } catch {
    // Guide may not exist
  }

  if (parts.length === 0) {
    throw new Error(`No skill files found for ${skillName}`);
  }

  return parts.join("\n\n---\n\n");
}

/** Aggregate results by product */
export function aggregateResults(results: EvalResult[]): ProductSummary[] {
  const byProduct = new Map<string, EvalResult[]>();

  for (const r of results) {
    const key = r.skillType === "hand-crafted" ? `${r.product}*` : r.product;
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key)!.push(r);
  }

  const summaries: ProductSummary[] = [];

  for (const [key, productResults] of byProduct) {
    const isHandCrafted = key.endsWith("*");
    const product = isHandCrafted ? key.slice(0, -1) : key;

    const avgWith =
      productResults.reduce((s, r) => s + r.withSkill.scores.composite, 0) /
      productResults.length;
    const avgWithout =
      productResults.reduce(
        (s, r) => s + r.withoutSkill.scores.composite,
        0,
      ) / productResults.length;

    // Collect and count error categories
    const errorCounts = new Map<ErrorCategory, number>();
    for (const r of productResults) {
      for (const e of r.topErrors) {
        errorCounts.set(e, (errorCounts.get(e) ?? 0) + 1);
      }
    }
    const topErrors = [...errorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e]) => e);

    summaries.push({
      product,
      caseCount: productResults.length,
      avgWithSkill: Math.round(avgWith),
      avgWithoutSkill: Math.round(avgWithout),
      avgDelta: Math.round(avgWith - avgWithout),
      topErrors,
      skillType: isHandCrafted ? "hand-crafted" : "generated",
    });
  }

  return summaries.sort((a, b) => b.avgDelta - a.avgDelta);
}

/** Evaluate a single case (both arms) */
async function evalCase(
  c: EvalCase,
  index: number,
  total: number,
  options: EvalOptions,
): Promise<EvalResult | null> {
  console.log(`[${index}/${total}] Evaluating ${c.id}...`);

  try {
    const skillContent = loadSkillContent(c.skill);

    const systemWith =
      "You have access to the following WorkOS integration skill. " +
      "Use it to inform your implementation.\n\n" +
      skillContent +
      "\n\nYou are a software engineer implementing a WorkOS integration. Write working code. Include imports, environment variable setup, and error handling. Use the WorkOS SDK appropriate for the requested language.";
    const systemWithout =
      "You are a software engineer implementing a WorkOS integration. Write working code. Include imports, environment variable setup, and error handling. Use the WorkOS SDK appropriate for the requested language.";

    // Run both arms in parallel — they're independent API calls
    const [withResult, withoutResult] = await Promise.all([
      getOrGenerate(c.prompt, skillContent, systemWith, options),
      getOrGenerate(c.prompt, null, systemWithout, options),
    ]);

    const withScores = scoreOutput(withResult.output, c.expected);
    const withoutScores = scoreOutput(withoutResult.output, c.expected);
    const errors = categorizeErrors(withoutResult.output, c.expected);

    const result: EvalResult = {
      caseId: c.id,
      product: c.product,
      language: c.language,
      skillType: c.skillType,
      withSkill: {
        output: withResult.output,
        scores: withScores,
        tokenUsage: withResult.usage,
      },
      withoutSkill: {
        output: withoutResult.output,
        scores: withoutScores,
        tokenUsage: withoutResult.usage,
      },
      delta: withScores.composite - withoutScores.composite,
      topErrors: errors,
    };

    console.log(
      `  ↳ with: ${withScores.composite}% | without: ${withoutScores.composite}% | delta: ${result.delta > 0 ? "+" : ""}${result.delta}%`,
    );
    return result;
  } catch (err) {
    console.error(`  ✗ ${c.id} failed: ${(err as Error).message}`);
    return null;
  }
}

/** Check cache, generate if miss */
async function getOrGenerate(
  prompt: string,
  skillContent: string | null,
  systemPrompt: string,
  options: EvalOptions,
): Promise<{ output: string; usage: { input: number; output: number } }> {
  const cacheKey = getCacheKey(options.model, systemPrompt, prompt);
  const cached = options.noCache ? null : await readCache(cacheKey);

  if (cached) return cached;

  const gen = await generateCode(prompt, skillContent, {
    apiKey: options.apiKey,
    model: options.model,
  });

  await writeCache(cacheKey, {
    output: gen.output,
    usage: gen.usage,
    model: options.model,
    cachedAt: new Date().toISOString(),
  });

  return gen;
}

/** Run the full eval */
export async function runEval(options: EvalOptions): Promise<EvalReport> {
  const cases = loadCases(CASES_DIR, {
    product: options.product,
    caseId: options.caseId,
  });

  if (cases.length === 0) {
    console.log("No eval cases found matching filters.");
    return {
      runId: new Date().toISOString(),
      model: options.model,
      totalCases: 0,
      results: [],
      summary: [],
    };
  }

  if (options.dryRun) {
    console.log(`\nDry run: ${cases.length} cases would be evaluated\n`);
    console.log("ID".padEnd(30) + "Product".padEnd(15) + "Skill".padEnd(25) + "Type");
    console.log("-".repeat(80));
    for (const c of cases) {
      console.log(
        c.id.padEnd(30) +
          c.product.padEnd(15) +
          c.skill.padEnd(25) +
          c.skillType,
      );
    }
    return {
      runId: new Date().toISOString(),
      model: options.model,
      totalCases: cases.length,
      results: [],
      summary: [],
    };
  }

  const concurrency = Math.max(1, options.concurrency);
  console.log(
    concurrency > 1
      ? `\nRunning ${cases.length} cases with concurrency ${concurrency}\n`
      : "",
  );

  const results: EvalResult[] = [];

  // Process in batches of `concurrency`
  for (let batch = 0; batch < cases.length; batch += concurrency) {
    const batchCases = cases.slice(batch, batch + concurrency);
    const batchResults = await Promise.allSettled(
      batchCases.map((c, idx) =>
        evalCase(c, batch + idx + 1, cases.length, options),
      ),
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value);
      }
    }
  }

  return {
    runId: new Date().toISOString(),
    model: options.model,
    totalCases: cases.length,
    results,
    summary: aggregateResults(results),
  };
}
