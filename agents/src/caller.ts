// ─────────────────────────────────────────────
// HansMed Core API Caller
// Handles all Anthropic API calls with:
// - Retry on failure
// - Token usage tracking
// - Structured logging
// ─────────────────────────────────────────────

import { Agent } from "./agents";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL   = "claude-sonnet-4-20250514";

// Fail fast if the API key isn't set — the original code had no
// Authorization header at all, so every call would have 401'd.
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("\n❌  ANTHROPIC_API_KEY environment variable is not set.");
  console.error("   Set it in your shell before running, e.g.:");
  console.error("     export ANTHROPIC_API_KEY='sk-ant-...'   (bash/zsh)");
  console.error("     $env:ANTHROPIC_API_KEY='sk-ant-...'     (PowerShell)");
  console.error("     set ANTHROPIC_API_KEY=sk-ant-...        (cmd)");
  process.exit(1);
}

export interface CallResult {
  agent: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface SessionStats {
  calls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
  estimatedCostUSD: number;
}

// Running session stats
const session: SessionStats = {
  calls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalDurationMs: 0,
  estimatedCostUSD: 0,
};

// Sonnet 4 pricing (per million tokens)
const PRICE_INPUT  = 3.00 / 1_000_000;
const PRICE_OUTPUT = 15.00 / 1_000_000;

export async function callAgent(
  agent: Agent,
  userMessage: string,
  context?: string,
  maxRetries = 2
): Promise<CallResult> {
  const messages = context
    ? [{ role: "user", content: `${context}\n\n${userMessage}` }]
    : [{ role: "user", content: userMessage }];

  const start = Date.now();
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         API_KEY as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system: agent.system,
          messages,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HTTP ${res.status}: ${err}`);
      }

      const data = await res.json() as {
        content?: { text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const output       = data.content?.[0]?.text ?? "";
      const inputTokens  = data.usage?.input_tokens  ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      const durationMs   = Date.now() - start;
      const cost         = (inputTokens * PRICE_INPUT) + (outputTokens * PRICE_OUTPUT);

      // Update session stats
      session.calls++;
      session.totalInputTokens  += inputTokens;
      session.totalOutputTokens += outputTokens;
      session.totalDurationMs   += durationMs;
      session.estimatedCostUSD  += cost;

      return {
        agent: agent.name,
        output,
        inputTokens,
        outputTokens,
        durationMs,
        success: true,
      };

    } catch (err: any) {
      lastError = err.message;
      if (attempt < maxRetries) {
        const wait = 1000 * (attempt + 1);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  return {
    agent: agent.name,
    output: "",
    inputTokens: 0,
    outputTokens: 0,
    durationMs: Date.now() - start,
    success: false,
    error: lastError,
  };
}

export function getSessionStats(): SessionStats {
  return { ...session };
}

export function resetSessionStats(): void {
  session.calls = 0;
  session.totalInputTokens = 0;
  session.totalOutputTokens = 0;
  session.totalDurationMs = 0;
  session.estimatedCostUSD = 0;
}
