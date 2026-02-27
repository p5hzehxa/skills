import { describe, expect, it } from 'vitest';
import { summarizeSignals, highlightOutput, formatSummary } from '../eval/diff.ts';
import type { ExpectedSignals } from '../eval/types.ts';

const expected: ExpectedSignals = {
  methods: ['workos.sso.getAuthorizationUrl', 'workos.sso.getProfileAndToken'],
  envVars: ['WORKOS_API_KEY', 'WORKOS_CLIENT_ID'],
  imports: ['@workos-inc/node'],
  params: ['clientId', 'redirectUri', 'code'],
  flowSteps: ['generate authorization URL', 'redirect user', 'exchange code'],
  antiPatterns: ['hardcoded API key'],
  hallucinations: ['workos.sso.authenticate'],
};

const perfectOutput = `
import { WorkOS } from "@workos-inc/node";
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;
// Generate authorization URL
const url = workos.sso.getAuthorizationUrl({ clientId, redirectUri: "/" });
// Redirect user to IdP
// Exchange code for profile
const { profile } = await workos.sso.getProfileAndToken({ code });
`;

const badOutput = `
import { WorkOS } from "@workos/node";
const workos = new WorkOS("sk_live_hardcoded_key");
const result = workos.sso.authenticate({ user: "test" });
`;

describe('summarizeSignals', () => {
  it('finds all signals in perfect output', () => {
    const s = summarizeSignals(perfectOutput, expected);
    expect(s.methods.found).toBe(2);
    expect(s.methods.missing).toHaveLength(0);
    expect(s.params.found).toBe(3);
    expect(s.envVars.found).toBe(2);
    expect(s.imports.found).toBe(1);
    expect(s.hallucinations.found).toBe(0);
    expect(s.flowSteps.found).toBe(3);
    expect(s.flowSteps.inOrder).toBe(true);
  });

  it('detects missing signals in bad output', () => {
    const s = summarizeSignals(badOutput, expected);
    expect(s.methods.found).toBe(0);
    expect(s.methods.missing).toContain('workos.sso.getAuthorizationUrl');
    expect(s.imports.found).toBe(0);
    expect(s.hallucinations.found).toBe(1);
    expect(s.hallucinations.names).toContain('workos.sso.authenticate');
  });

  it('returns zeros for empty expected', () => {
    const empty: ExpectedSignals = {
      methods: [],
      envVars: [],
      imports: [],
      params: [],
      flowSteps: [],
      antiPatterns: [],
    };
    const s = summarizeSignals('any output', empty);
    expect(s.methods.total).toBe(0);
    expect(s.hallucinations.found).toBe(0);
  });

  it('detects out-of-order flow steps', () => {
    const reversed = `
Exchange code for profile.
Redirect user to login.
Generate authorization URL.
`;
    const s = summarizeSignals(reversed, expected);
    expect(s.flowSteps.found).toBe(3);
    expect(s.flowSteps.inOrder).toBe(false);
  });
});

describe('highlightOutput', () => {
  it('wraps hallucinations in red underline ANSI', () => {
    const result = highlightOutput('use workos.sso.authenticate() here', expected);
    expect(result).toContain('\x1b[4m\x1b[31m');
    expect(result).toContain('authenticate');
  });

  it('wraps methods in green background ANSI', () => {
    const result = highlightOutput('call getAuthorizationUrl()', expected);
    expect(result).toContain('\x1b[42m\x1b[30m');
  });

  it('wraps anti-patterns in yellow ANSI', () => {
    const result = highlightOutput('uses hardcoded API key in code', expected);
    expect(result).toContain('\x1b[33m');
  });

  it('returns unchanged output when no signals match', () => {
    const input = 'nothing relevant here';
    const result = highlightOutput(input, expected);
    expect(result).toBe(input);
  });
});

describe('formatSummary', () => {
  it('shows check marks for perfect signals', () => {
    const s = summarizeSignals(perfectOutput, expected);
    const text = formatSummary(s);
    expect(text).toContain('2/2');
    expect(text).toContain('3/3');
    expect(text).toContain('✓');
  });

  it('shows X marks for missing signals', () => {
    const s = summarizeSignals(badOutput, expected);
    const text = formatSummary(s);
    expect(text).toContain('0/2');
    expect(text).toContain('✗');
  });

  it('lists missing methods', () => {
    const s = summarizeSignals(badOutput, expected);
    const text = formatSummary(s);
    expect(text).toContain('missing:');
    expect(text).toContain('getAuthorizationUrl');
  });
});
