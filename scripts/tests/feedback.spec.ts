import { describe, expect, it } from "vitest";
import {
  loadFeedback,
  parseFeedbackMarkdown,
  formatFeedbackForPrompt,
} from "../lib/feedback.ts";
import type { SkillFeedback } from "../lib/types.ts";

describe("loadFeedback", () => {
  it("returns empty feedback for skill with no .feedback.md", () => {
    const feedback = loadFeedback("nonexistent-skill-xyz");
    expect(feedback).toEqual({ corrections: [], emphasis: [] });
  });

  it("loads feedback from workos-directory-sync", () => {
    const feedback = loadFeedback("workos-directory-sync");
    expect(feedback.corrections.length).toBeGreaterThan(0);
    expect(feedback.corrections[0]).toContain("webhooks");
    expect(feedback.emphasis.length).toBeGreaterThan(0);
  });

  it("loads feedback from workos-migrate-aws-cognito", () => {
    const feedback = loadFeedback("workos-migrate-aws-cognito");
    expect(feedback.corrections.length).toBeGreaterThan(0);
    expect(feedback.corrections[0]).toContain("password hash");
  });

  it("loads feedback from workos-migrate-descope", () => {
    const feedback = loadFeedback("workos-migrate-descope");
    expect(feedback.emphasis.length).toBeGreaterThan(0);
    expect(feedback.emphasis[0]).toContain("userManagement.createUser");
  });

  it("loads feedback from workos-migrate-other-services", () => {
    const feedback = loadFeedback("workos-migrate-other-services");
    expect(feedback.emphasis.length).toBeGreaterThan(0);
    expect(feedback.emphasis[0]).toContain("decision tree");
  });

  it("loads feedback from workos-migrate-the-standalone-sso-api", () => {
    const feedback = loadFeedback("workos-migrate-the-standalone-sso-api");
    expect(feedback.corrections.length).toBeGreaterThan(0);
    expect(feedback.emphasis.length).toBeGreaterThan(0);
  });
});

describe("parseFeedbackMarkdown", () => {
  it("parses corrections and emphasis from valid markdown", () => {
    const md = `# Feedback for workos-directory-sync

## Corrections
- WorkOS supports both webhooks AND the Events API.
- The Events API is a valid alternative for batch processing.

## Emphasis
- The dsync.deleted event does NOT trigger individual events.
`;
    const result = parseFeedbackMarkdown(md);
    expect(result.corrections).toHaveLength(2);
    expect(result.corrections[0]).toContain("webhooks AND the Events API");
    expect(result.corrections[1]).toContain(
      "Events API is a valid alternative",
    );
    expect(result.emphasis).toHaveLength(1);
    expect(result.emphasis[0]).toContain("dsync.deleted");
  });

  it("returns empty arrays for empty string", () => {
    const result = parseFeedbackMarkdown("");
    expect(result).toEqual({ corrections: [], emphasis: [] });
  });

  it("returns empty arrays for whitespace-only string", () => {
    const result = parseFeedbackMarkdown("   \n\n  ");
    expect(result).toEqual({ corrections: [], emphasis: [] });
  });

  it("returns empty arrays for markdown without recognized headings", () => {
    const md = `# Some feedback

This is just prose without any corrections or emphasis sections.

## Unrelated Section
- Some item
`;
    const result = parseFeedbackMarkdown(md);
    expect(result).toEqual({ corrections: [], emphasis: [] });
  });

  it("handles only corrections (no emphasis)", () => {
    const md = `## Corrections
- First correction.
- Second correction.
`;
    const result = parseFeedbackMarkdown(md);
    expect(result.corrections).toHaveLength(2);
    expect(result.emphasis).toHaveLength(0);
  });

  it("handles only emphasis (no corrections)", () => {
    const md = `## Emphasis
- Important point A.
- Important point B.
`;
    const result = parseFeedbackMarkdown(md);
    expect(result.corrections).toHaveLength(0);
    expect(result.emphasis).toHaveLength(2);
  });

  it("handles multi-line list items (continuation lines)", () => {
    const md = `## Corrections
- WorkOS supports both webhooks AND the Events API for directory sync.
  Do not claim webhooks are mandatory or that polling is not supported.
`;
    const result = parseFeedbackMarkdown(md);
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]).toContain(
      "Do not claim webhooks are mandatory",
    );
  });

  it("stops collecting when a new heading is reached", () => {
    const md = `## Corrections
- A correction.

## Something Else
- Not a correction.

## Emphasis
- An emphasis.
`;
    const result = parseFeedbackMarkdown(md);
    expect(result.corrections).toHaveLength(1);
    expect(result.emphasis).toHaveLength(1);
  });

  it("handles asterisk list markers", () => {
    const md = `## Corrections
* First correction.
* Second correction.
`;
    const result = parseFeedbackMarkdown(md);
    expect(result.corrections).toHaveLength(2);
  });

  it("is case-insensitive for headings", () => {
    const md = `## CORRECTIONS
- A correction.

## emphasis
- An emphasis.
`;
    const result = parseFeedbackMarkdown(md);
    expect(result.corrections).toHaveLength(1);
    expect(result.emphasis).toHaveLength(1);
  });
});

describe("formatFeedbackForPrompt", () => {
  it("returns empty string for no feedback", () => {
    const feedback: SkillFeedback = { corrections: [], emphasis: [] };
    expect(formatFeedbackForPrompt(feedback)).toBe("");
  });

  it("formats corrections with MUST language", () => {
    const feedback: SkillFeedback = {
      corrections: ["WorkOS supports both webhooks AND the Events API."],
      emphasis: [],
    };
    const result = formatFeedbackForPrompt(feedback);
    expect(result).toContain("Corrections (MUST respect)");
    expect(result).toContain(
      "WorkOS supports both webhooks AND the Events API.",
    );
  });

  it("formats emphasis with SHOULD language", () => {
    const feedback: SkillFeedback = {
      corrections: [],
      emphasis: ["The dsync.deleted event is a common trap."],
    };
    const result = formatFeedbackForPrompt(feedback);
    expect(result).toContain("Emphasis (SHOULD highlight)");
    expect(result).toContain("dsync.deleted event is a common trap");
  });

  it("formats both corrections and emphasis", () => {
    const feedback: SkillFeedback = {
      corrections: ["A correction."],
      emphasis: ["An emphasis."],
    };
    const result = formatFeedbackForPrompt(feedback);
    expect(result).toContain("MUST respect");
    expect(result).toContain("SHOULD highlight");
    expect(result).toContain("A correction.");
    expect(result).toContain("An emphasis.");
  });

  it("includes domain expert attribution header", () => {
    const feedback: SkillFeedback = {
      corrections: ["Something."],
      emphasis: [],
    };
    const result = formatFeedbackForPrompt(feedback);
    expect(result).toContain("Domain Expert Feedback");
  });
});
