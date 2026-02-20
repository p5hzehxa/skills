import { describe, expect, it } from "bun:test";
import {
  generateSkill,
  generateRouter,
  generateIntegrationRouter,
} from "../lib/generator.ts";
import type { SkillSpec, Section } from "../lib/types.ts";

function makeSpec(overrides: Partial<SkillSpec> = {}): SkillSpec {
  return {
    name: "workos-sso",
    description: "Configure Single Sign-On.",
    title: "WorkOS Single Sign-On",
    anchor: "sso",
    content:
      "SSO content here.\n\n### Getting Started\n\nStart with SSO.\n\n### Configuration\n\nConfigure SSO settings.",
    docUrls: [
      "https://workos.com/docs/sso/index",
      "https://workos.com/docs/sso/test-sso",
    ],
    generated: true,
    ...overrides,
  };
}

describe("generateSkill", () => {
  it("returns a [summary, guide] tuple", () => {
    const result = generateSkill(makeSpec());
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("summary");
    expect(result[1].type).toBe("guide");
  });

  it("summary has correct path (.md)", () => {
    const [summary] = generateSkill(makeSpec());
    expect(summary.path).toBe("plugins/workos/skills/workos/references/workos-sso.md");
  });

  it("guide has correct path (.guide.md)", () => {
    const [, guide] = generateSkill(makeSpec());
    expect(guide.path).toBe("plugins/workos/skills/workos/references/workos-sso.guide.md");
  });

  it("both share the same sourceHash", () => {
    const [summary, guide] = generateSkill(makeSpec());
    expect(summary.sourceHash).toMatch(/^[a-f0-9]{12}$/);
    expect(guide.sourceHash).toBe(summary.sourceHash);
  });

  it("summary does not have frontmatter", () => {
    const [summary] = generateSkill(makeSpec());
    expect(summary.content).not.toStartWith("---\n");
  });

  it("guide does not have frontmatter", () => {
    const [, guide] = generateSkill(makeSpec());
    expect(guide.content).not.toStartWith("---\n");
  });

  it("summary contains guide pointer", () => {
    const [summary] = generateSkill(makeSpec());
    expect(summary.content).toContain("workos-sso.guide.md");
  });

  it("summary includes When to Use and Key Vocabulary", () => {
    const [summary] = generateSkill(makeSpec());
    expect(summary.content).toContain("## When to Use");
    expect(summary.content).toContain("## Key Vocabulary");
  });

  it("summary includes Related Skills", () => {
    const [summary] = generateSkill(makeSpec());
    expect(summary.content).toContain("## Related Skills");
    expect(summary.content).toContain("workos-integrations");
  });

  it("guide includes implementation sections", () => {
    const [, guide] = generateSkill(makeSpec());
    expect(guide.content).toContain("## Step 1: Fetch Documentation");
    expect(guide.content).toContain("## Prerequisites");
    expect(guide.content).toContain("## Implementation Guide");
    expect(guide.content).toContain("## Verification Checklist");
    expect(guide.content).toContain("## Error Recovery");
  });

  it("guide includes doc URL references", () => {
    const [, guide] = generateSkill(makeSpec());
    expect(guide.content).toContain("https://workos.com/docs/sso/index");
  });

  it("both have generated markers", () => {
    const [summary, guide] = generateSkill(makeSpec());
    expect(summary.content).toMatch(/<!-- generated:sha256:[a-f0-9]{12} -->/);
    expect(guide.content).toMatch(/<!-- generated:sha256:[a-f0-9]{12} -->/);
  });

  it("both calculate sizeBytes", () => {
    const [summary, guide] = generateSkill(makeSpec());
    expect(summary.sizeBytes).toBe(Buffer.byteLength(summary.content, "utf8"));
    expect(guide.sizeBytes).toBe(Buffer.byteLength(guide.content, "utf8"));
  });

  it("both mark generated: true", () => {
    const [summary, guide] = generateSkill(makeSpec());
    expect(summary.generated).toBe(true);
    expect(guide.generated).toBe(true);
  });
});

describe("generateRouter", () => {
  it("includes all generated skill names in topic map", () => {
    const specs = [
      makeSpec({ name: "workos-sso", anchor: "sso" }),
      makeSpec({ name: "workos-vault", anchor: "vault" }),
    ];
    const result = generateRouter(specs, "");
    expect(result.content).toContain("workos-sso");
    expect(result.content).toContain("workos-vault");
  });

  it("includes hand-crafted AuthKit skills", () => {
    const result = generateRouter([], "");
    expect(result.content).toContain("workos-authkit-nextjs");
    expect(result.content).toContain("workos-authkit-react");
    expect(result.content).toContain("workos-authkit-react-router");
    expect(result.content).toContain("workos-authkit-tanstack-start");
    expect(result.content).toContain("workos-authkit-vanilla-js");
    expect(result.content).toContain("workos-authkit-base");
  });

  it("has correct name and path", () => {
    const result = generateRouter([], "");
    expect(result.name).toBe("workos");
    expect(result.path).toBe("plugins/workos/skills/workos/SKILL.md");
  });

  it("includes generated marker with source hash", () => {
    const result = generateRouter([], "");
    expect(result.content).toMatch(/<!-- generated:sha256:[a-f0-9]{12} -->/);
  });

  it("returns single GeneratedSkill (not tuple)", () => {
    const result = generateRouter([], "");
    expect(result.name).toBe("workos");
    // Not an array — router is a single file
    expect(Array.isArray(result)).toBe(false);
  });
});

describe("generateSkill with API ref spec", () => {
  it("generates stub guide for workos-api-* specs", () => {
    const spec = makeSpec({
      name: "workos-api-sso",
      title: "WorkOS SSO API Reference",
      anchor: "reference",
      content:
        "| Endpoint | Description |\n| -------- | ----------- |\n| `/sso/authorize` | Generate auth URL |",
      docUrls: ["https://workos.com/docs/reference/sso"],
    });
    const [summary, guide] = generateSkill(spec);
    expect(summary.type).toBe("summary");
    expect(guide.type).toBe("guide");
    expect(guide.sizeBytes).toBeLessThan(2048);
    expect(guide.content).toContain("Quick Reference");
    expect(guide.content).toContain("WebFetch");
    expect(guide.content).not.toContain("## Prerequisites");
    expect(guide.content).not.toContain("## Error Recovery");
  });

  it("stub points to feature guide", () => {
    const spec = makeSpec({
      name: "workos-api-sso",
      title: "WorkOS SSO API Reference",
      anchor: "reference",
      docUrls: ["https://workos.com/docs/reference/sso"],
    });
    const [, guide] = generateSkill(spec);
    expect(guide.content).toContain("workos-sso.guide.md");
  });

  it("stub includes endpoint table from content", () => {
    const spec = makeSpec({
      name: "workos-api-sso",
      title: "WorkOS SSO API Reference",
      anchor: "reference",
      content:
        "| Endpoint | Description |\n| -------- | ----------- |\n| `/sso/authorize` | Generate auth URL |",
      docUrls: ["https://workos.com/docs/reference/sso"],
    });
    const [, guide] = generateSkill(spec);
    expect(guide.content).toContain("## Endpoints");
    expect(guide.content).toContain("/sso/authorize");
  });
});

describe("generateIntegrationRouter", () => {
  const integrationsSection: Section = {
    name: "Integrations",
    anchor: "integrations",
    content: "Integration content",
    sizeBytes: 19,
    lineCount: 1,
    subsections: [],
  };

  it("includes provider lookup table", () => {
    const urls = new Map([
      [
        "integrations",
        [
          "https://workos.com/docs/integrations/okta-saml",
          "https://workos.com/docs/integrations/google-saml",
        ],
      ],
    ]);
    const result = generateIntegrationRouter(integrationsSection, urls);
    expect(result.content).toContain("Okta");
    expect(result.content).toContain("SAML");
  });

  it("has correct name and path", () => {
    const urls = new Map<string, string[]>();
    const result = generateIntegrationRouter(integrationsSection, urls);
    expect(result.name).toBe("workos-integrations");
    expect(result.path).toBe("plugins/workos/skills/workos/references/workos-integrations.md");
  });
});
