import { describe, expect, it } from "bun:test";
import { runQualityGate, semanticQualityCheck } from "../lib/quality-gate.ts";
import type { GeneratedSkill } from "../lib/types.ts";

/** Minimal valid skill for testing */
function makeSkill(overrides: Partial<GeneratedSkill> = {}): GeneratedSkill {
  const content =
    overrides.content ??
    `---
name: workos-test-skill
description: Test skill for quality gate
---

<!-- generated:sha256:abc123def456 -->

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
    path: overrides.path ?? "skills/workos/workos-test-skill.md",
    content,
    sizeBytes: overrides.sizeBytes ?? Buffer.byteLength(content, "utf8"),
    generated: overrides.generated ?? true,
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

  it("fails skill with no frontmatter", async () => {
    const skill = makeSkill({
      content: "<!-- generated -->\n\nNo frontmatter here.",
      sizeBytes: 40,
    });
    const report = await runQualityGate([skill]);
    expect(report.results[0].score).toBeLessThan(70);
    expect(report.results[0].issues).toContain("No valid frontmatter found");
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
