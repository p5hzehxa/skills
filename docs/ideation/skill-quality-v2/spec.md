# Implementation Spec: Skill Quality V2

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Four independent improvements to the generation pipeline, all touching the same refiner → template → quality gate chain. Execute sequentially since files overlap. No new dependencies. After code changes, run `bun run scripts/generate.ts --refine --force` to regenerate all skills and validate.

## Feedback Strategy

**Inner-loop command**: `bun test`

**Playground**: Test suite — unit tests for quality gate scoring + integration tests for path resolution.

**Why this approach**: All 4 improvements are validated by either scoring tests (quality gate) or file-system assertions (path tests). No UI or server involved.

## File Changes

### New Files

| File Path                     | Purpose                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `scripts/tests/paths.spec.ts` | Integration tests validating guide pointers, router refs, Related Skills cross-refs resolve to real files |

### Modified Files

| File Path                            | Changes                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/refiner.ts`             | Content taxonomy: allow ONE code example. Feature guide prompt: add code example rule. Summary prompt: drop Documentation section, target 400-600B, max 5 vocabulary. |
| `scripts/lib/skill-template.ts`      | Add `renderApiRefStub()`. Remove `renderDocumentation()` call from `renderSummary()`.                                                                                 |
| `scripts/lib/generator.ts`           | Route `workos-api-*` specs to `renderApiRefStub()` instead of `renderGuide()`.                                                                                        |
| `scripts/lib/quality-gate.ts`        | Add `scoreApiRefStub()`. Update `scoreGuide()` with code example bonus. Update `scoreSummary()`: drop doc URL criterion, tighten size scoring.                        |
| `scripts/lib/config.ts`              | `SUMMARY_VALIDATION.maxSize`: 5120→2048                                                                                                                               |
| `scripts/generate.ts`                | Skip refinement for API ref guides (deterministic stubs).                                                                                                             |
| `scripts/tests/quality-gate.spec.ts` | Tests for code example bonus, API ref stub scoring, updated summary scoring. Update `makeSummary()` helper.                                                           |
| `scripts/tests/generator.spec.ts`    | Test API ref spec produces stub guide.                                                                                                                                |

## Implementation Details

### Component 1: Inline Code Examples in Feature Guides

**Pattern to follow**: Hand-crafted skills in `skills/workos-authkit-nextjs/SKILL.md` (has real code examples)

**Overview**: Relax the "NO code" rule to allow ONE language-agnostic SDK pattern per guide. The refiner prompt instructs the LLM to include a 10-25 line example showing the primary integration pattern using `workos.{domain}.{method}()` syntax without language-specific constructs.

**Key decisions**:

- Language-agnostic SDK syntax — shows `workos.sso.getAuthorizationURL()` style without `const`, type annotations, or imports
- ONE example only — variations stay as pseudocode
- Quality gate rewards presence (+5 pts) but still penalizes blocks >40 lines

**Implementation steps**:

1. In `scripts/lib/refiner.ts`, update `getContentTaxonomyBlock()` — change the "Complete code implementations" line:

   ```
   BEFORE: "Complete code implementations → Instead provide pseudocode showing the PATTERN, not exact code"
   AFTER:  "Complete code implementations → Include ONE language-agnostic SDK example (10-25 lines) for the primary pattern; pseudocode for variations"
   ```

2. In `scripts/lib/refiner.ts`, update `buildRefinePrompt()` — add new rule in the numbered rules section:

   ```
   Include ONE primary code example (10-25 lines) in the Implementation Guide section.
   Use language-agnostic SDK syntax: workos.{domain}.{method}() with generic variable names.
   Show the most common integration pattern — what every developer does first.
   Do NOT use TypeScript/Python/Ruby-specific syntax (no const, no type annotations, no imports).
   For alternative patterns, use pseudocode.
   ```

3. In `scripts/lib/quality-gate.ts`, update `scoreGuide()`:
   - Redistribute "No doc dump" criterion from 15 → 10 pts
   - Add new criterion "Has code example" worth 5 pts:

   ```typescript
   // Has at least one code example (5 pts)
   const meaningfulCodeBlocks = codeBlocks.filter((block) => {
     const lines = block.split("\n").length - 2; // exclude fence lines
     return lines >= 5;
   });
   if (meaningfulCodeBlocks.length > 0) {
     score += 5;
   } else {
     issues.push(
       "No code example found (guides should have one 10-25 line SDK pattern)",
     );
   }
   ```

4. In `scripts/tests/quality-gate.spec.ts`, add test:

   ````typescript
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
   ````

**Feedback loop**:

- **Playground**: `scripts/tests/quality-gate.spec.ts`
- **Experiment**: Guide with/without code blocks, verify score difference
- **Check command**: `bun test scripts/tests/quality-gate.spec.ts`

---

### Component 2: API Reference Guide Stubs

**Pattern to follow**: `renderSummary()` in `scripts/lib/skill-template.ts` (deterministic template generation)

**Overview**: Replace 11 full API ref guides (5-10KB, mostly restating docs) with ~500B stubs containing: marker, title, doc URLs, endpoint table, pointer to feature guide. Skip LLM refinement — stubs are deterministic.

**Key decisions**:

- Stubs are generated by template, not refined by LLM — saves refinement time
- API ref summaries stay unchanged (already small routing docs)
- Feature guide pointer uses `workos-api-{domain}` → `workos-{domain}` name mapping
- Quality gate gets a dedicated `scoreApiRefStub()` with relaxed size expectations

**Implementation steps**:

1. In `scripts/lib/skill-template.ts`, add exported function:

   ```typescript
   /** Deterministic stub for API reference guides — endpoint table + doc pointer */
   export function renderApiRefStub(
     spec: SkillSpec,
     sourceHash?: string,
   ): string {
     const parts: string[] = [];
     parts.push(
       sourceHash
         ? `<!-- generated:sha256:${sourceHash} -->`
         : "<!-- generated -->",
     );
     parts.push("");
     parts.push(`# ${spec.title} — Quick Reference`);
     parts.push("");
     parts.push("## Step 1: Fetch Documentation");
     parts.push("");
     parts.push("**WebFetch the API reference before making calls.**");
     parts.push("");
     for (const url of spec.docUrls.slice(0, 5)) {
       parts.push(`- ${url}`);
     }
     parts.push("");
     // Extract endpoint table if present
     const tableMatch = spec.content.match(
       /\|[^\n]*(?:Endpoint|Method|Path)[^\n]*\|[\s\S]*?(?=\n\n|\n[^|]|$)/i,
     );
     if (tableMatch) {
       parts.push("## Endpoints");
       parts.push("");
       parts.push(tableMatch[0].trim());
       parts.push("");
     }
     // Pointer to feature guide
     const featureName = spec.name.replace("workos-api-", "workos-");
     parts.push("## Implementation");
     parts.push("");
     parts.push("For integration patterns, error recovery, and verification:");
     parts.push("");
     parts.push(`> Read \`skills/workos/${featureName}.guide.md\``);
     parts.push("");
     return parts.join("\n");
   }
   ```

2. In `scripts/lib/generator.ts`, update `generateSkill()`:

   ```typescript
   import {
     renderSummary,
     renderGuide,
     renderApiRefStub,
   } from "./skill-template.ts";

   // Inside generateSkill():
   const isApiRef = spec.name.startsWith("workos-api-");
   const guideContent = isApiRef
     ? renderApiRefStub(spec, sourceHash)
     : renderGuide(spec, sourceHash);
   ```

3. In `scripts/generate.ts`, skip refinement for API ref guide stubs. In the refinement filter:

   ```typescript
   // API ref guides are deterministic stubs — no refinement needed
   if (s.name.startsWith("workos-api-") && s.type === "guide") return false;
   ```

4. In `scripts/lib/quality-gate.ts`, add `scoreApiRefStub()` function:

   ```typescript
   async function scoreApiRefStub(
     skill: GeneratedSkill,
     options: QualityGateOptions,
   ): Promise<QualityResult> {
     const issues: string[] = [];
     let score = 0;
     const content = skill.content;

     // 1. Marker (20 pts)
     if (
       /<!--\s*(?:generated|refined)(?::sha256:[a-f0-9]+)?\s*-->/.test(content)
     ) {
       score += 20;
     } else {
       issues.push("Missing generated/refined marker");
     }

     // 2. No frontmatter (10 pts)
     if (!content.match(/^---\n([\s\S]*?)\n---/)) {
       score += 10;
     } else {
       issues.push("Stub should not have frontmatter");
     }

     // 3. Doc URLs (20 pts)
     if ((content.match(/https:\/\/workos\.com\/docs\//g) || []).length >= 1) {
       score += 20;
     } else {
       issues.push("No doc URL references found");
     }

     // 4. Endpoint table or structured content (20 pts)
     if (
       /\|\s*(?:Endpoint|Method|Path)/i.test(content) ||
       /\|\s*`?\//.test(content)
     ) {
       score += 20;
     } else {
       issues.push("Missing endpoint table");
     }

     // 5. Feature guide pointer (20 pts)
     if (/Read\s+`?skills\/workos\/.*\.guide\.md`?/.test(content)) {
       score += 20;
     } else {
       issues.push("Missing feature guide pointer");
     }

     // 6. Size <2KB (10 pts)
     if (skill.sizeBytes <= 2048) {
       score += 10;
     } else {
       issues.push(
         `Stub is ${(skill.sizeBytes / 1024).toFixed(1)}KB — should be under 2KB`,
       );
     }

     return {
       skillName: `${skill.name} (api-ref-stub)`,
       pass: score >= 70,
       score,
       issues,
     };
   }
   ```

5. Update routing in the quality gate dispatcher:

   ```typescript
   if (skill.type === "guide" && skill.name.startsWith("workos-api-")) {
     return scoreApiRefStub(skill, options);
   }
   ```

6. In `scripts/tests/generator.spec.ts`, add:

   ```typescript
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
   });
   ```

7. In `scripts/tests/quality-gate.spec.ts`, add:

   ```typescript
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
   
   > Read \`skills/workos/workos-sso.guide.md\`
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
   });
   ```

**Feedback loop**:

- **Playground**: `scripts/tests/generator.spec.ts` + `scripts/tests/quality-gate.spec.ts`
- **Experiment**: Generate API ref spec, verify stub output + scoring
- **Check command**: `bun test scripts/tests/generator.spec.ts scripts/tests/quality-gate.spec.ts`

---

### Component 3: Trim Summaries to ~500 Bytes

**Pattern to follow**: Current `renderSummary()` in `scripts/lib/skill-template.ts`

**Overview**: Drop the Documentation section from summaries (guide already has it), reduce Key Vocabulary from 10→5 max bullets, tighten size scoring. Target 400-600B after frontmatter.

**Key decisions**:

- Documentation URLs removed entirely — they exist in guides' "Step 1: Fetch Documentation"
- Key Vocabulary max reduced from 10→5 bullets
- Quality gate: doc URL criterion (15pts) removed, redistributed to Key Vocabulary (15→20) and size (10→20, tiered)
- SUMMARY_VALIDATION.maxSize: 5120→2048

**Implementation steps**:

1. In `scripts/lib/skill-template.ts`, update `renderSummary()` — remove the `renderDocumentation(spec.docUrls)` call. Summary sections become: frontmatter → marker → title → When to Use → Key Vocabulary → Implementation Guide (pointer) → Related Skills.

2. In `scripts/lib/refiner.ts`, update `buildSummaryRefinePrompt()`:
   - Remove Documentation from the section list (5→4 sections)
   - Change size target: "400-600 bytes after frontmatter. If your output exceeds 800B, you wrote too much."
   - Change Key Vocabulary max: "Maximum 5 bullet points" (was 10)
   - Update user prompt to include: "Do NOT include a Documentation section — doc URLs live in the guide."

3. In `scripts/lib/quality-gate.ts`, update `scoreSummary()`:
   - Remove doc URL check (was 15 pts)
   - Key Vocabulary: 15→20 pts
   - Size: replace `<5KB` check (10 pts) with tiered scoring (20 pts):
     ```typescript
     if (skill.sizeBytes <= 1024)
       score += 20; // ideal: under 1KB
     else if (skill.sizeBytes <= 2048)
       score += 15; // acceptable: under 2KB
     else
       issues.push(
         `Summary is ${(skill.sizeBytes / 1024).toFixed(1)}KB — should be under 1KB`,
       );
     ```
   - Final rubric (100 pts): frontmatter(20) + marker(5) + When to Use(15) + Key Vocabulary(20) + guide pointer(15) + Related Skills(5) + size(20)

4. In `scripts/lib/config.ts`, update `SUMMARY_VALIDATION.maxSize` from 5120 to 2048.

5. In `scripts/tests/quality-gate.spec.ts`:
   - Update `makeSummary()` default content — remove `## Documentation` section
   - Update "flags summary over 5KB" → "flags summary over 1KB" with 2048+ byte content, assert `includes("under 1KB")`
   - Verify well-formed summary still scores ≥70

**Feedback loop**:

- **Playground**: `scripts/tests/quality-gate.spec.ts`
- **Experiment**: Score summary with/without Documentation, verify totals
- **Check command**: `bun test scripts/tests/quality-gate.spec.ts`

---

### Component 4: Path Resolution Integration Tests

**Pattern to follow**: `scripts/tests/generator.spec.ts` (Bun test runner + describe/it/expect)

**Overview**: New integration test file that reads the actual `skills/workos/` directory and validates all cross-file references resolve to existing files.

**Implementation steps**:

1. Create `scripts/tests/paths.spec.ts` with these test cases:
   - **"every summary has a matching guide"** — for each `.md` file (excluding `.guide.md`, `.feedback.md`, `SKILL.md`, `workos-integrations.md`), verify a corresponding `.guide.md` exists
   - **"no orphaned guides without summaries"** — for each `.guide.md`, verify the matching `.md` summary exists
   - **"guide pointers resolve to existing files"** — extract `Read skills/workos/*.guide.md` from each summary, verify the target file exists
   - **"router references resolve to existing summaries"** — extract `skills/workos/*.md` references from `SKILL.md`, verify each exists
   - **"Related Skills references point to existing skills"** — extract `**workos-*` references from Related Skills sections, skip hand-crafted skills (they live in subdirectories), verify matching `.md` files exist

   Full code in the plan file above.

**Feedback loop**: None needed — this is a test component.

## Testing Requirements

### Unit Tests

| Test File                            | Coverage                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `scripts/tests/quality-gate.spec.ts` | Code example bonus, API ref stub scoring, updated summary scoring, updated `makeSummary()` |
| `scripts/tests/generator.spec.ts`    | API ref spec produces stub guide, stub points to feature guide                             |

### Integration Tests

| Test File                     | Coverage                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `scripts/tests/paths.spec.ts` | Guide pointer resolution, router references, Related Skills cross-refs, orphan detection |

## Validation Commands

```bash
# Unit + integration tests
bun test

# Format check
bun run format:check

# Full regeneration with refinement
bun run scripts/generate.ts --refine --force

# Verify API ref stubs are small
ls -la skills/workos/workos-api-*.guide.md

# Verify summaries are under 1KB
wc -c skills/workos/workos-{sso,vault,mfa,rbac}.md

# Quality gate should report 64/64 passing (or 63/64 if standalone-sso persists)
```
