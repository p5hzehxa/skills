import type { TokenUsage } from "./types.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const EVAL_MAX_TOKENS = 4096;
const RATE_LIMIT_DELAY_MS = 1000;

export interface GenerateResult {
  output: string;
  usage: TokenUsage;
}

export async function generateCode(
  prompt: string,
  systemPrompt: string,
  options: { apiKey: string; model: string },
): Promise<GenerateResult> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: EVAL_MAX_TOKENS,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();

    if (response.status === 429) {
      // Rate limited — wait and retry once
      await rateLimitDelay(5000);
      return generateCode(prompt, systemPrompt, options);
    }

    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  if (!text.trim()) {
    throw new Error("Anthropic API returned empty response");
  }

  return {
    output: text.trim(),
    usage: {
      input: data.usage.input_tokens,
      output: data.usage.output_tokens,
    },
  };
}

export function rateLimitDelay(ms = RATE_LIMIT_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
