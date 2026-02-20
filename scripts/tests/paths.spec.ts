import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const PLUGIN_DIR = join(import.meta.dir, "../../plugins/workos/skills/workos");
const REFS_DIR = join(PLUGIN_DIR, "references");

function listRefFiles(): string[] {
  return readdirSync(REFS_DIR);
}

function readRef(filename: string): string {
  return readFileSync(join(REFS_DIR, filename), "utf-8");
}

function readPluginFile(filename: string): string {
  return readFileSync(join(PLUGIN_DIR, filename), "utf-8");
}

describe("path resolution", () => {
  const files = listRefFiles();
  const summaries = files.filter(
    (f) =>
      f.endsWith(".md") &&
      !f.endsWith(".guide.md") &&
      !f.endsWith(".feedback.md") &&
      f !== "workos-integrations.md",
  );
  const guides = files.filter((f) => f.endsWith(".guide.md"));
  const allMdFiles = new Set(files.filter((f) => f.endsWith(".md")));

  it("every summary has a matching guide", () => {
    const missing: string[] = [];
    for (const summary of summaries) {
      const guideName = summary.replace(".md", ".guide.md");
      if (!allMdFiles.has(guideName)) {
        missing.push(`${summary} → ${guideName}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("no orphaned guides without summaries", () => {
    const orphaned: string[] = [];
    for (const guide of guides) {
      const summaryName = guide.replace(".guide.md", ".md");
      if (!allMdFiles.has(summaryName)) {
        orphaned.push(guide);
      }
    }
    expect(orphaned).toEqual([]);
  });

  it("guide pointers resolve to existing files", () => {
    const broken: string[] = [];
    for (const summary of summaries) {
      const content = readRef(summary);
      const match = content.match(
        /Read\s+`?(?:(?:skills\/workos\/)?references\/)?([^`\s]+\.guide\.md)`?/,
      );
      if (match && !allMdFiles.has(match[1])) {
        broken.push(`${summary} → ${match[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("router references resolve to existing summaries", () => {
    const router = readPluginFile("SKILL.md");
    const broken: string[] = [];
    for (const match of router.matchAll(/references\/([^\s`|]+\.md)/g)) {
      const ref = match[1];
      // Skip template patterns like {name}.md, workos-[feature].md
      if (ref.includes("{") || ref.includes("[")) continue;
      if (!allMdFiles.has(ref)) {
        broken.push(`SKILL.md → ${ref}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("Related Skills references point to existing skills", () => {
    const HAND_CRAFTED = new Set([
      "workos-authkit-base",
      "workos-authkit-nextjs",
      "workos-authkit-react",
      "workos-authkit-react-router",
      "workos-authkit-tanstack-start",
      "workos-authkit-vanilla-js",
    ]);
    // Skills referenced in Related Skills but not generated (skipped sections)
    const KNOWN_MISSING = new Set([
      "workos-domain-verification", // skip: true in config
      "workos-fga", // skip: true in config
      "workos-user-management", // not a generated skill
    ]);
    const broken: string[] = [];
    for (const file of files.filter((f) => f.endsWith(".md"))) {
      const content = readRef(file);
      const section = content.match(/## Related Skills\n([\s\S]*?)(?=\n## |$)/);
      if (!section) continue;
      for (const ref of section[1].matchAll(/\*\*(workos-[a-z0-9-]+)\*\*/g)) {
        if (HAND_CRAFTED.has(ref[1]) || KNOWN_MISSING.has(ref[1])) continue;
        if (!allMdFiles.has(`${ref[1]}.md`)) {
          broken.push(`${file} → ${ref[1]}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
