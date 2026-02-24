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
 * Score flow step presence and ordering (0-1).
 * 60% weight on presence, 40% weight on correct relative ordering.
 */
export function scoreFlowOrder(steps: string[], output: string): number {
  if (steps.length === 0) return 1;

  const lowerOutput = output.toLowerCase();

  // Find position of each step in the output (-1 if not found)
  const positions = steps.map((step) => {
    const keywords = step.toLowerCase().split(/\s+/);
    // Find the first occurrence where all keywords appear nearby
    // Simplified: find the first keyword's position
    for (let i = 0; i < keywords.length; i++) {
      const pos = lowerOutput.indexOf(keywords[i]);
      if (pos !== -1) return pos;
    }
    return -1;
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
 * Compute weighted composite score (0-100).
 * Weights: methods(25) + flow(25) + params(15) + envVars(15) + antiPatterns(15) + clean(5)
 * Clean bonus: 5 points for zero hallucinations.
 * Hallucination penalty: -5 per hallucination, capped at -25.
 */
export function weightedScore(
  dimensions: Omit<ScoreCard, "composite">,
): number {
  const base =
    dimensions.methodAccuracy * 25 +
    dimensions.paramAccuracy * 15 +
    dimensions.envVarCoverage * 15 +
    dimensions.flowCorrectness * 25 +
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
  const methodAccuracy = ratioFound(expected.methods, output);
  const paramAccuracy = ratioFound(expected.params, output);
  const envVarCoverage = ratioFound(expected.envVars, output);
  const flowCorrectness = scoreFlowOrder(expected.flowSteps, output);
  const antiPatternAvoidance = 1 - ratioFound(expected.antiPatterns, output);
  const hallucinationCount = countFound(expected.hallucinations ?? [], output);

  const dimensions = {
    methodAccuracy,
    paramAccuracy,
    envVarCoverage,
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
  if (ratioFound(expected.methods, output) < 1) {
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
  if (ratioFound(expected.antiPatterns, output) > 0) {
    errors.push("security_issue");
  }

  return errors;
}
