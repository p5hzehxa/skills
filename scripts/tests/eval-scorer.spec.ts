import { describe, expect, it } from "bun:test";
import {
  normalizeForMatch,
  ratioFound,
  scoreFlowOrder,
  countFound,
  weightedScore,
  scoreOutput,
  categorizeErrors,
} from "../eval/scorer.ts";
import type { ExpectedSignals } from "../eval/types.ts";

describe("normalizeForMatch", () => {
  it("lowercases", () => {
    expect(normalizeForMatch("WORKOS_API_KEY")).toBe("workos_api_key");
  });

  it("converts camelCase to snake_case", () => {
    expect(normalizeForMatch("getAuthorizationUrl")).toBe(
      "get_authorization_url",
    );
  });

  it("converts kebab-case to snake_case", () => {
    expect(normalizeForMatch("get-authorization-url")).toBe(
      "get_authorization_url",
    );
  });

  it("preserves dots in method chains", () => {
    expect(normalizeForMatch("workos.sso.getAuthorizationUrl")).toBe(
      "workos.sso.get_authorization_url",
    );
  });

  it("handles empty string", () => {
    expect(normalizeForMatch("")).toBe("");
  });

  it("handles already-normalized strings", () => {
    expect(normalizeForMatch("workos_api_key")).toBe("workos_api_key");
  });
});

describe("ratioFound", () => {
  const output = `
import { WorkOS } from "@workos-inc/node";
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const url = workos.sso.getAuthorizationUrl({ clientId, redirectUri });
const profile = workos.sso.getProfileAndToken({ code });
  `;

  it("returns 1.0 for empty expected array", () => {
    expect(ratioFound([], output)).toBe(1);
  });

  it("finds all expected items", () => {
    expect(
      ratioFound(
        ["workos.sso.getAuthorizationUrl", "workos.sso.getProfileAndToken"],
        output,
      ),
    ).toBe(1);
  });

  it("returns partial ratio for partial matches", () => {
    expect(
      ratioFound(
        [
          "workos.sso.getAuthorizationUrl",
          "workos.sso.nonExistentMethod",
          "workos.sso.getProfileAndToken",
        ],
        output,
      ),
    ).toBeCloseTo(2 / 3, 2);
  });

  it("returns 0 when nothing found", () => {
    expect(ratioFound(["totally.fake.method"], output)).toBe(0);
  });

  it("matches case-insensitively", () => {
    expect(ratioFound(["WORKOS_API_KEY"], output)).toBe(1);
  });

  it("matches snake_case against camelCase", () => {
    expect(ratioFound(["get_authorization_url"], output)).toBe(1);
  });
});

describe("scoreFlowOrder", () => {
  const output = `
First, generate the authorization URL.
Then redirect the user to the IdP.
After the user authenticates, handle the callback.
Finally, exchange the code for a profile.
  `;

  it("returns 1.0 for all steps in correct order", () => {
    expect(
      scoreFlowOrder(
        [
          "generate authorization URL",
          "redirect user",
          "handle callback",
          "exchange code for profile",
        ],
        output,
      ),
    ).toBe(1);
  });

  it("returns 0 for no steps found", () => {
    expect(
      scoreFlowOrder(["step not present", "also missing"], output),
    ).toBe(0);
  });

  it("gives partial credit for present but unordered steps", () => {
    const reversed = `
Finally, exchange the code for a profile.
First, generate the authorization URL.
    `;
    const score = scoreFlowOrder(
      ["generate authorization URL", "exchange code for profile"],
      reversed,
    );
    // Both present (0.6 * 1.0) but wrong order (0.4 * 0)
    expect(score).toBeCloseTo(0.6, 1);
  });

  it("returns 1.0 for empty steps", () => {
    expect(scoreFlowOrder([], output)).toBe(1);
  });

  it("handles partial presence", () => {
    const score = scoreFlowOrder(
      ["generate authorization URL", "step not present"],
      output,
    );
    // 1/2 present = 0.5, presence component: 0.6 * 0.5 = 0.3
    // ordering: 1/1 in order (only 1 found) = 1.0, order component: 0.4 * 1.0 = 0.4
    // total = 0.7
    expect(score).toBeCloseTo(0.7, 1);
  });
});

describe("countFound", () => {
  const output = `workos.sso.authenticate and workos.sso.login`;

  it("counts matches", () => {
    expect(
      countFound(["workos.sso.authenticate", "workos.sso.login"], output),
    ).toBe(2);
  });

  it("returns 0 for no matches", () => {
    expect(countFound(["not.here"], output)).toBe(0);
  });

  it("returns 0 for empty list", () => {
    expect(countFound([], output)).toBe(0);
  });
});

describe("weightedScore", () => {
  it("returns 100 for perfect scores with no hallucinations", () => {
    expect(
      weightedScore({
        methodAccuracy: 1,
        paramAccuracy: 1,
        envVarCoverage: 1,
        flowCorrectness: 1,
        antiPatternAvoidance: 1,
        hallucinationCount: 0,
      }),
    ).toBe(100);
  });

  it("returns 0 for all-zero scores", () => {
    expect(
      weightedScore({
        methodAccuracy: 0,
        paramAccuracy: 0,
        envVarCoverage: 0,
        flowCorrectness: 0,
        antiPatternAvoidance: 0,
        hallucinationCount: 0,
      }),
    ).toBe(5); // clean bonus only (no hallucinations even with zero scores)
  });

  it("applies hallucination penalty capped at 25", () => {
    const perfect = weightedScore({
      methodAccuracy: 1,
      paramAccuracy: 1,
      envVarCoverage: 1,
      flowCorrectness: 1,
      antiPatternAvoidance: 1,
      hallucinationCount: 0,
    });
    const withHallucinations = weightedScore({
      methodAccuracy: 1,
      paramAccuracy: 1,
      envVarCoverage: 1,
      flowCorrectness: 1,
      antiPatternAvoidance: 1,
      hallucinationCount: 3,
    });
    // Loses 5pt clean bonus + 15pt penalty (3 * 5) = 20pt difference
    expect(perfect - withHallucinations).toBe(20);

    // Cap at 25 penalty + 5 lost clean bonus = 30 max difference
    const maxPenalty = weightedScore({
      methodAccuracy: 1,
      paramAccuracy: 1,
      envVarCoverage: 1,
      flowCorrectness: 1,
      antiPatternAvoidance: 1,
      hallucinationCount: 10,
    });
    expect(perfect - maxPenalty).toBe(30); // 25 penalty + 5 lost clean bonus
  });

  it("never goes below 0", () => {
    expect(
      weightedScore({
        methodAccuracy: 0,
        paramAccuracy: 0,
        envVarCoverage: 0,
        flowCorrectness: 0,
        antiPatternAvoidance: 0,
        hallucinationCount: 10,
      }),
    ).toBe(0);
  });
});

describe("scoreOutput", () => {
  const expected: ExpectedSignals = {
    methods: ["workos.sso.getAuthorizationUrl", "workos.sso.getProfileAndToken"],
    envVars: ["WORKOS_API_KEY", "WORKOS_CLIENT_ID"],
    imports: ["@workos-inc/node"],
    params: ["clientId", "redirectUri", "code"],
    flowSteps: [
      "generate authorization URL",
      "redirect user",
      "handle callback",
      "exchange code for profile",
    ],
    antiPatterns: ["hardcoded API key"],
    hallucinations: ["workos.sso.authenticate", "@workos/node"],
  };

  it("scores a perfect output near 100", () => {
    const perfectOutput = `
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;

// Step 1: Generate authorization URL
const authUrl = workos.sso.getAuthorizationUrl({ clientId, redirectUri: "http://localhost:3000/callback" });

// Step 2: Redirect user to the IdP
res.redirect(authUrl);

// Step 3: Handle callback with authorization code
app.get("/callback", async (req, res) => {
  const { code } = req.query;

  // Step 4: Exchange code for profile
  const { profile } = await workos.sso.getProfileAndToken({ code });
  req.session.user = profile;
  res.redirect("/dashboard");
});
    `;
    const scores = scoreOutput(perfectOutput, expected);
    expect(scores.composite).toBeGreaterThanOrEqual(90);
    expect(scores.hallucinationCount).toBe(0);
  });

  it("scores a terrible output below 30", () => {
    const terribleOutput = `
import { WorkOS } from "@workos/node";
const workos = new WorkOS("sk_live_hardcoded_key_here");
const result = workos.sso.authenticate({ user: "test" });
workos.sso.login({ password: "123" });
    `;
    const scores = scoreOutput(terribleOutput, expected);
    expect(scores.composite).toBeLessThan(30);
    expect(scores.hallucinationCount).toBeGreaterThan(0);
  });
});

describe("categorizeErrors", () => {
  const expected: ExpectedSignals = {
    methods: ["workos.sso.getAuthorizationUrl"],
    envVars: ["WORKOS_API_KEY"],
    imports: ["@workos-inc/node"],
    params: ["clientId"],
    flowSteps: ["generate authorization URL"],
    antiPatterns: [],
    hallucinations: ["workos.sso.authenticate"],
  };

  it("detects hallucinated methods", () => {
    const output = "workos.sso.authenticate()";
    const errors = categorizeErrors(output, expected);
    expect(errors).toContain("hallucinated_method");
  });

  it("detects missing env vars", () => {
    const output = "some code without env vars";
    const errors = categorizeErrors(output, expected);
    expect(errors).toContain("missing_env_var");
  });

  it("detects wrong imports", () => {
    const output = "some code without correct import";
    const errors = categorizeErrors(output, expected);
    expect(errors).toContain("wrong_import");
  });

  it("returns empty for perfect output", () => {
    const output = `
import { WorkOS } from "@workos-inc/node";
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;
const url = workos.sso.getAuthorizationUrl({ clientId });
// Generate authorization URL
    `;
    const errors = categorizeErrors(output, expected);
    expect(errors).not.toContain("hallucinated_method");
    expect(errors).not.toContain("missing_env_var");
  });
});
