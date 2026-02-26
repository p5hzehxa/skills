import { describe, expect, it } from "vitest";
import { runQualityGate, semanticQualityCheck } from "../lib/quality-gate.ts";
import type { GeneratedSkill } from "../lib/types.ts";

/** Minimal valid guide for testing */
function makeSkill(overrides: Partial<GeneratedSkill> = {}): GeneratedSkill {
  const content =
    overrides.content ??
    `<!-- generated:sha256:abc123def456 -->

## Step 1: Fetch Documentation

- https://workos.com/docs/test
- https://workos.com/docs/test/setup
- https://workos.com/docs/test/api

## Implementation Guide

Follow these steps to implement.

## Verification Checklist

- [ ] Verify setup works

\`\`\`bash
curl -s https://api.workos.com/health
\`\`\`

## Error Recovery

### Common Issues

Check fetched docs for current API requirements.
`;
  return {
    name: overrides.name ?? "workos-test-skill",
    path:
      overrides.path ??
      "plugins/workos/skills/workos/references/workos-test-skill.guide.md",
    content,
    sizeBytes: overrides.sizeBytes ?? Buffer.byteLength(content, "utf8"),
    generated: overrides.generated ?? true,
    type: "guide" as const,
    ...overrides,
  };
}

/** Minimal valid summary for testing */
function makeSummary(overrides: Partial<GeneratedSkill> = {}): GeneratedSkill {
  const content =
    overrides.content ??
    `<!-- generated:sha256:abc123def456 -->

# WorkOS Test Skill

## When to Use

Use this skill when you need to test the quality gate scoring.

## Key Vocabulary

Key structural vocabulary for the test domain including identifiers and patterns.

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read \`references/workos-test-skill.guide.md\`

## Related Skills

- **workos-sso**: Single Sign-On configuration
`;
  return {
    name: overrides.name ?? "workos-test-skill",
    path:
      overrides.path ??
      "plugins/workos/skills/workos/references/workos-test-skill.md",
    content,
    sizeBytes: overrides.sizeBytes ?? Buffer.byteLength(content, "utf8"),
    generated: overrides.generated ?? true,
    type: "summary" as const,
    ...overrides,
  };
}

describe("runQualityGate", () => {
  it("passes a well-formed skill", async () => {
    const skill = makeSkill();
    const report = await runQualityGate([skill]);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(0);
    expect(report.results[0].score).toBeGreaterThanOrEqual(70);
  });

  it("fails guide with minimal content", async () => {
    const skill = makeSkill({
      content: "<!-- generated -->\n\nNo content here.",
      sizeBytes: 40,
    });
    const report = await runQualityGate([skill]);
    expect(report.results[0].score).toBeLessThan(70);
  });

  it("detects missing generated marker", async () => {
    const content = `---
name: test
description: test
---

## Content

Some content here.
`;
    const skill = makeSkill({ content, sizeBytes: Buffer.byteLength(content) });
    const report = await runQualityGate([skill]);
    expect(
      report.results[0].issues.some((i) => i.includes("Missing generated")),
    ).toBe(true);
  });
});

describe("behavioral claim check", () => {
  it("penalizes behavioral assertions without doc deferral", async () => {
    const content = `---
name: workos-test
description: test
---

<!-- generated:sha256:abc123def456 -->

## Step 1: Fetch Documentation

- https://workos.com/docs/test
- https://workos.com/docs/test/setup
- https://workos.com/docs/test/api

## Implementation

SSO is required for all enterprise customers.
MFA is mandatory for admin users.
Custom domains is not supported in sandbox mode.

## Verification Checklist

- [ ] Check setup

\`\`\`bash
echo "ok"
\`\`\`

## Error Recovery

### Issues
`;
    const skill = makeSkill({ content, sizeBytes: Buffer.byteLength(content) });
    const report = await runQualityGate([skill]);
    const result = report.results[0];
    expect(result.issues.some((i) => i.includes("behavioral assertion"))).toBe(
      true,
    );
  });

  it("does not penalize when 'check fetched docs' is nearby", async () => {
    const content = `---
name: workos-test
description: test
---

<!-- generated:sha256:abc123def456 -->

## Step 1: Fetch Documentation

- https://workos.com/docs/test
- https://workos.com/docs/test/setup
- https://workos.com/docs/test/api

## Implementation

Check fetched docs for whether SSO is required for enterprise customers.

## Verification Checklist

- [ ] Check setup

\`\`\`bash
echo "ok"
\`\`\`

## Error Recovery

### Issues
`;
    const skill = makeSkill({ content, sizeBytes: Buffer.byteLength(content) });
    const report = await runQualityGate([skill]);
    const result = report.results[0];
    expect(result.issues.some((i) => i.includes("behavioral assertion"))).toBe(
      false,
    );
  });
});

describe("code block size check", () => {
  it("penalizes code blocks >40 lines", async () => {
    const longCodeBlock =
      "```typescript\n" + "const x = 1;\n".repeat(45) + "```";
    const content = `---
name: workos-test
description: test
---

<!-- generated:sha256:abc123def456 -->

## Step 1: Fetch Documentation

- https://workos.com/docs/test
- https://workos.com/docs/test/setup
- https://workos.com/docs/test/api

## Implementation

${longCodeBlock}

## Verification Checklist

- [ ] Check setup

\`\`\`bash
echo "ok"
\`\`\`

## Error Recovery

### Issues
`;
    const skill = makeSkill({ content, sizeBytes: Buffer.byteLength(content) });
    const report = await runQualityGate([skill]);
    expect(report.results[0].issues.some((i) => i.includes(">40 lines"))).toBe(
      true,
    );
  });
});

describe("code example bonus", () => {
  it("gives bonus for guide with code block >=5 lines", async () => {
    const codeBlock = "```typescript\n" + "const x = 1;\n".repeat(8) + "```";
    const content = `<!-- generated:sha256:abc123def456 -->

## Step 1: Fetch Documentation

- https://workos.com/docs/test
- https://workos.com/docs/test/setup
- https://workos.com/docs/test/api

## Implementation Guide

${codeBlock}

## Verification Checklist

- [ ] Check setup

\`\`\`bash
echo "ok"
\`\`\`

## Error Recovery

### Issues
`;
    const withCode = makeSkill({
      content,
      sizeBytes: Buffer.byteLength(content),
    });
    const withCodeReport = await runQualityGate([withCode]);

    const noCode = makeSkill(); // default has no code blocks >=5 lines
    const noCodeReport = await runQualityGate([noCode]);

    expect(withCodeReport.results[0].score).toBeGreaterThan(
      noCodeReport.results[0].score,
    );
  });
});

describe("removed check docs penalty", () => {
  it("does not penalize excessive doc deferrals", async () => {
    const content = `---
name: workos-test
description: test
---

<!-- generated:sha256:abc123def456 -->

## Step 1: Fetch Documentation

- https://workos.com/docs/test
- https://workos.com/docs/test/setup
- https://workos.com/docs/test/api

## Implementation

Check the docs for exact method signature.
Check the documentation for current rate limits.
Check the docs for specific error codes.
Check the documentation for actual webhook format.
Check the docs for exact payload structure.

## Verification Checklist

- [ ] Check setup

\`\`\`bash
echo "ok"
\`\`\`

## Error Recovery

### Issues
`;
    const skill = makeSkill({ content, sizeBytes: Buffer.byteLength(content) });
    const report = await runQualityGate([skill]);
    expect(
      report.results[0].issues.some((i) =>
        i.includes('Excessive "check docs"'),
      ),
    ).toBe(false);
  });
});

describe("summary scoring", () => {
  it("passes a well-formed summary", async () => {
    const summary = makeSummary();
    const report = await runQualityGate([summary]);
    expect(report.passed).toBe(1);
    expect(report.results[0].score).toBeGreaterThanOrEqual(70);
  });

  it("fails summary missing guide pointer", async () => {
    const content = `<!-- generated:sha256:abc123def456 -->

## When to Use

Some content here.

## Key Vocabulary

Some concepts.
`;
    const summary = makeSummary({
      content,
      sizeBytes: Buffer.byteLength(content),
    });
    const report = await runQualityGate([summary]);
    expect(
      report.results[0].issues.some((i) => i.includes("guide pointer")),
    ).toBe(true);
  });

  it("flags summary over 1KB", async () => {
    const content =
      `<!-- generated:sha256:abc123def456 -->

## When to Use

Use this.

## Key Vocabulary

Concepts here.

## Implementation Guide

→ Read \`references/workos-test.guide.md\`

` + "x".repeat(2200);
    const summary = makeSummary({
      content,
      sizeBytes: Buffer.byteLength(content),
    });
    const report = await runQualityGate([summary]);
    expect(report.results[0].issues.some((i) => i.includes("under 1KB"))).toBe(
      true,
    );
  });
});

describe("guide scoring", () => {
  it("passes guide without frontmatter", async () => {
    const guide = makeSkill();
    const report = await runQualityGate([guide]);
    expect(report.passed).toBe(1);
  });

  it("flags guide with frontmatter", async () => {
    const content = `---
name: workos-test
description: test
---

<!-- generated:sha256:abc123def456 -->

## Step 1: Fetch Documentation

- https://workos.com/docs/test
- https://workos.com/docs/test/setup
- https://workos.com/docs/test/api

## Implementation Guide

Steps here.

## Verification Checklist

- [ ] Check

\`\`\`bash
echo ok
\`\`\`

## Error Recovery

### Issues
`;
    const guide = makeSkill({ content, sizeBytes: Buffer.byteLength(content) });
    const report = await runQualityGate([guide]);
    expect(
      report.results[0].issues.some((i) =>
        i.includes("should not have frontmatter"),
      ),
    ).toBe(true);
  });
});

describe("API ref stub scoring", () => {
  it("passes a well-formed API ref stub", async () => {
    const content = `<!-- generated:sha256:abc123def456 -->

# WorkOS SSO API Reference — Quick Reference

## Step 1: Fetch Documentation

- https://workos.com/docs/reference/sso

## Endpoints

| Endpoint | Description |
| -------- | ----------- |
| \`/sso/authorize\` | Generate auth URL |

## Implementation

> Read \`references/workos-sso.guide.md\`
`;
    const stub = makeSkill({
      name: "workos-api-sso",
      content,
      sizeBytes: Buffer.byteLength(content),
    });
    const report = await runQualityGate([stub]);
    expect(report.passed).toBe(1);
    expect(report.results[0].score).toBeGreaterThanOrEqual(70);
  });

  it("fails stub missing feature guide pointer", async () => {
    const content = `<!-- generated:sha256:abc123def456 -->

# WorkOS SSO API Reference — Quick Reference

## Step 1: Fetch Documentation

- https://workos.com/docs/reference/sso

## Endpoints

| Endpoint | Description |
| -------- | ----------- |
| \`/sso/authorize\` | Generate auth URL |
`;
    const stub = makeSkill({
      name: "workos-api-sso",
      content,
      sizeBytes: Buffer.byteLength(content),
    });
    const report = await runQualityGate([stub]);
    expect(
      report.results[0].issues.some((i) => i.includes("feature guide pointer")),
    ).toBe(true);
  });
});

describe("semanticQualityCheck", () => {
  // Semantic check requires an API key — these tests validate the function signature
  // and error handling. Real API calls are skipped.

  it("returns default result on API failure", async () => {
    const result = await semanticQualityCheck(
      "some skill content",
      { corrections: ["Must mention webhooks"], emphasis: [] },
      { apiKey: "invalid-key" },
    );
    // Should gracefully handle the failure
    expect(result).toHaveProperty("pass");
    expect(result).toHaveProperty("violations");
    expect(result).toHaveProperty("score");
  });
});
