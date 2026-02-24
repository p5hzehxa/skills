/** A single eval test case — declarative, lives in YAML */
export interface EvalCase {
  id: string;
  product: string;
  skill: string;
  skillType: "generated" | "hand-crafted";
  language?: string;
  framework?: string;
  prompt: string;
  expected: ExpectedSignals;
}

/** Expected signals to check in LLM output */
export interface ExpectedSignals {
  methods: string[];
  envVars: string[];
  imports: string[];
  params: string[];
  flowSteps: string[];
  antiPatterns: string[];
  hallucinations?: string[];
}

/** Scores for a single generation run (with or without skill) */
export interface ScoreCard {
  methodAccuracy: number;
  paramAccuracy: number;
  envVarCoverage: number;
  flowCorrectness: number;
  antiPatternAvoidance: number;
  hallucinationCount: number;
  composite: number;
}

export type ErrorCategory =
  | "hallucinated_method"
  | "wrong_params"
  | "missing_env_var"
  | "wrong_flow_order"
  | "incorrect_config"
  | "missing_error_handling"
  | "wrong_import"
  | "security_issue";

export interface TokenUsage {
  input: number;
  output: number;
}

/** Result of one eval case (both arms) */
export interface EvalResult {
  caseId: string;
  product: string;
  language?: string;
  skillType: "generated" | "hand-crafted";
  withSkill: { output: string; scores: ScoreCard; tokenUsage: TokenUsage };
  withoutSkill: { output: string; scores: ScoreCard; tokenUsage: TokenUsage };
  delta: number;
  topErrors: ErrorCategory[];
}

/** Per-product aggregated summary */
export interface ProductSummary {
  product: string;
  caseCount: number;
  avgWithSkill: number;
  avgWithoutSkill: number;
  avgDelta: number;
  topErrors: ErrorCategory[];
  skillType?: "generated" | "hand-crafted";
}

/** Full eval run report */
export interface EvalReport {
  runId: string;
  model: string;
  totalCases: number;
  results: EvalResult[];
  summary: ProductSummary[];
}

/** CLI options */
export interface EvalOptions {
  product?: string;
  caseId?: string;
  model: string;
  noCache: boolean;
  dryRun: boolean;
  concurrency: number;
  apiKey: string;
}
