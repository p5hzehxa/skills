import type { ExpectedSignals, ScoreCard, ErrorCategory } from "./types.ts";

/**
 * Normalize a string for flexible matching across naming conventions.
 * Converts camelCase → snake_case, kebab-case → snake_case, lowercases.
 * Preserves dots for method chains (e.g., workos.sso.getAuthorizationUrl).
 */
export function normalizeForMatch(s: string): string {
  if (!s) return "";

  return (
    s
      // Insert underscore before uppercase runs: getAuthorizationUrl → get_Authorization_Url
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      // Handle consecutive caps: getHTTPResponse → get_HTTP_Response → get_h_t_t_p_response after lowercase
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      // kebab-case to snake_case
      .replace(/-/g, "_")
      .toLowerCase()
  );
}

/**
 * Ratio of expected items found in the output (0-1).
 * Returns 1.0 if expected array is empty (no penalty for empty expectations).
 */
export function ratioFound(expected: string[], output: string): number {
  if (expected.length === 0) return 1;

  const normalizedOutput = normalizeForMatch(output);
  let found = 0;

  for (const item of expected) {
    if (normalizedOutput.includes(normalizeForMatch(item))) {
      found++;
    }
  }

  return found / expected.length;
}

/**
 * Invocation-aware method matching (0-1).
 * Three-pass: try method( invocation → last-segment invocation → substring fallback.
 * Returns 1.0 if expected array is empty.
 */
export function methodRatioFound(expected: string[], output: string): number {
  if (expected.length === 0) return 1;

  const normalizedOutput = normalizeForMatch(output);
  let found = 0;

  for (const method of expected) {
    const normalized = normalizeForMatch(method);

    // Pass 1: full invocation form — method_name( or workos.sso.method(
    if (normalizedOutput.includes(normalized + "(")) {
      found++;
      continue;
    }

    // Pass 2: last segment invocation — get_authorization_url(
    const dotParts = normalized.split(".");
    if (dotParts.length > 1) {
      const lastPart = dotParts[dotParts.length - 1] + "(";
      if (normalizedOutput.includes(lastPart)) {
        found++;
        continue;
      }
    }

    // Pass 3: full normalized substring (prose mentions still count)
    if (normalizedOutput.includes(normalized)) {
      found++;
      continue;
    }

    // Pass 4: last segment substring — catches "use getAuthorizationUrl to..."
    const parts = normalized.split(".");
    if (parts.length > 1 && normalizedOutput.includes(parts[parts.length - 1])) {
      found++;
    }
  }

  return found / expected.length;
}

/**
 * Score flow step presence and ordering (0-1).
 * 60% weight on presence, 40% weight on correct relative ordering.
 */
export function scoreFlowOrder(steps: string[], output: string): number {
  if (steps.length === 0) return 1;

  const lowerOutput = output.toLowerCase();

  // Find position of each step in the output (-1 if not found).
  // Uses proximity-based matching: find the position where the most keywords
  // co-occur within a ~200-char window. Prevents generic words like "check"
  // from matching a distant Verification section when the actual step context
  // (e.g., "check state parameter") lives elsewhere.
  const positions = steps.map((step) => {
    const keywords = step.toLowerCase().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return -1;

    // Single keyword — use simple indexOf (no proximity needed)
    if (keywords.length === 1) {
      return lowerOutput.indexOf(keywords[0]);
    }

    // Multi-keyword: find the window with the best keyword co-occurrence
    const WINDOW = 200;
    let bestPos = -1;
    let bestCount = 0;

    for (const kw of keywords) {
      let searchFrom = 0;
      while (searchFrom < lowerOutput.length) {
        const anchor = lowerOutput.indexOf(kw, searchFrom);
        if (anchor === -1) break;

        // Count how many other keywords appear within WINDOW of this anchor
        const windowStart = Math.max(0, anchor - WINDOW);
        const windowEnd = Math.min(
          lowerOutput.length,
          anchor + kw.length + WINDOW,
        );
        const window = lowerOutput.slice(windowStart, windowEnd);

        let coCount = 0;
        for (const other of keywords) {
          if (window.includes(other)) coCount++;
        }

        if (coCount > bestCount) {
          bestCount = coCount;
          bestPos = anchor;
        }

        // If all keywords co-occur, no need to keep searching
        if (bestCount === keywords.length) break;

        searchFrom = anchor + 1;
      }
      if (bestCount === keywords.length) break;
    }

    return bestPos;
  });

  const foundPositions = positions.filter((p) => p !== -1);
  const presenceRatio = foundPositions.length / steps.length;

  if (foundPositions.length <= 1) {
    // 0 or 1 steps found — ordering is trivially correct for found steps
    return presenceRatio * 0.6 + (foundPositions.length > 0 ? 0.4 : 0);
  }

  // Check monotonically increasing order among found steps
  let inOrder = 0;
  for (let i = 1; i < foundPositions.length; i++) {
    if (foundPositions[i] > foundPositions[i - 1]) {
      inOrder++;
    }
  }
  const orderRatio = inOrder / (foundPositions.length - 1);

  return presenceRatio * 0.6 + orderRatio * 0.4;
}

/**
 * Count how many items from the list appear in the output.
 */
export function countFound(items: string[], output: string): number {
  if (items.length === 0) return 0;

  const normalizedOutput = normalizeForMatch(output);
  let count = 0;

  for (const item of items) {
    if (normalizedOutput.includes(normalizeForMatch(item))) {
      count++;
    }
  }

  return count;
}

/**
 * Check if a match appears inside a .env block or env placeholder context.
 * Returns true for patterns like `WORKOS_API_KEY=sk_test_xxx` or `# .env` blocks,
 * which are not real hardcoded keys — just configuration examples.
 */
export function isInEnvBlock(output: string, matchIndex: number): boolean {
  // Look back ~150 chars for env context
  const lookback = output
    .slice(Math.max(0, matchIndex - 150), matchIndex)
    .toLowerCase();
  // Look at the line containing the match
  const lineStart = output.lastIndexOf("\n", matchIndex) + 1;
  const lineEnd = output.indexOf("\n", matchIndex);
  const line = output
    .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
    .trim();

  // Env file header nearby: `.env`, `# .env`, `env vars`, `environment variables`
  if (/(?:^|\s|#\s*)\.env\b|env(?:ironment)?\s*var/i.test(lookback)) {
    return true;
  }

  // Line looks like KEY=value (env file format)
  if (/^[A-Z][A-Z0-9_]+=\S/.test(line)) {
    return true;
  }

  // Placeholder indicators on the same line
  if (/your[_-]|<your|replace|placeholder/i.test(line)) {
    return true;
  }

  return false;
}

/**
 * Check if a match at the given index is preceded by a negation word.
 * Looks back up to 60 chars for words like don't, not, never, avoid.
 */
export function isNegated(output: string, matchIndex: number): boolean {
  const prefix = output
    .slice(Math.max(0, matchIndex - 30), matchIndex)
    .toLowerCase()
    .trim();
  // Check for negation word in the 30-char prefix.
  // Uses word boundaries to avoid matching "note", "cannot", etc.
  return /\b(don'?t|do not|never|avoid|shouldn'?t|should not|not)\b/.test(
    prefix,
  );
}

/**
 * Negation-aware ratio of anti-patterns found in output.
 * Returns 0 if expected is empty (no anti-patterns to check = 0 found).
 * Skips matches preceded by negation words.
 */
export function negationAwareRatioFound(
  expected: string[],
  output: string,
): number {
  if (expected.length === 0) return 0;

  const normalizedOutput = normalizeForMatch(output);
  const lowerOutput = output.toLowerCase();
  let found = 0;

  for (const item of expected) {
    const normalizedItem = normalizeForMatch(item);
    const idx = normalizedOutput.indexOf(normalizedItem);
    if (idx !== -1) {
      // Skip negated mentions ("don't use sk_live") and env placeholders
      // ("WORKOS_API_KEY=sk_test_your_key"). Check on original text, not
      // normalized, because normalizeForMatch mangles whitespace.
      if (!isNegated(lowerOutput, idx) && !isInEnvBlock(output, idx)) {
        found++;
      }
    }
  }

  return found / expected.length;
}

/**
 * Compute weighted composite score (0-100).
 * Weights: methods(20) + flow(20) + imports(10) + params(15) + envVars(15) + antiPatterns(15) + clean(5)
 * Clean bonus: 5 points for zero hallucinations.
 * Hallucination penalty: -5 per hallucination, capped at -25.
 */
export function weightedScore(
  dimensions: Omit<ScoreCard, "composite">,
): number {
  const base =
    dimensions.methodAccuracy * 20 +
    dimensions.paramAccuracy * 15 +
    dimensions.envVarCoverage * 15 +
    dimensions.importAccuracy * 10 +
    dimensions.flowCorrectness * 20 +
    dimensions.antiPatternAvoidance * 15 +
    (dimensions.hallucinationCount === 0 ? 5 : 0);

  const penalty = Math.min(dimensions.hallucinationCount * 5, 25);
  return Math.max(0, Math.round(base - penalty));
}

/**
 * Score an LLM output against expected signals.
 */
export function scoreOutput(
  output: string,
  expected: ExpectedSignals,
): ScoreCard {
  const methodAccuracy = methodRatioFound(expected.methods, output);
  const paramAccuracy = ratioFound(expected.params, output);
  const envVarCoverage = ratioFound(expected.envVars, output);
  const importAccuracy =
    expected.imports.length > 0 ? ratioFound(expected.imports, output) : 1;
  const flowCorrectness = scoreFlowOrder(expected.flowSteps, output);
  const antiPatternAvoidance =
    1 - negationAwareRatioFound(expected.antiPatterns, output);
  const hallucinationCount = countFound(expected.hallucinations ?? [], output);

  const dimensions = {
    methodAccuracy,
    paramAccuracy,
    envVarCoverage,
    importAccuracy,
    flowCorrectness,
    antiPatternAvoidance,
    hallucinationCount,
  };

  return {
    ...dimensions,
    composite: weightedScore(dimensions),
  };
}

/**
 * Categorize errors in an LLM output based on expected signals.
 */
export function categorizeErrors(
  output: string,
  expected: ExpectedSignals,
): ErrorCategory[] {
  const errors: ErrorCategory[] = [];

  if (countFound(expected.hallucinations ?? [], output) > 0) {
    errors.push("hallucinated_method");
  }
  if (
    expected.methods.length > 0 &&
    methodRatioFound(expected.methods, output) < 1
  ) {
    errors.push("missing_method");
  }
  if (expected.params.length > 0 && ratioFound(expected.params, output) < 1) {
    errors.push("wrong_params");
  }
  if (ratioFound(expected.envVars, output) < 1) {
    errors.push("missing_env_var");
  }
  if (ratioFound(expected.imports, output) < 1) {
    errors.push("wrong_import");
  }
  if (scoreFlowOrder(expected.flowSteps, output) < 0.8) {
    errors.push("wrong_flow_order");
  }
  if (negationAwareRatioFound(expected.antiPatterns, output) > 0) {
    errors.push("security_issue");
  }

  return errors;
}
