# HansMed Agent System

Four Claude-backed agents wired into pipelines that produce + review content and code for the HansMed TCM platform.

| Agent | Emoji | Role |
|---|---|---|
| Dev | 💻 | Writes Next.js / TypeScript / Supabase code |
| QA | 🧪 | Reviews code for bugs, edge cases, PDPA gaps |
| Marketing | 📣 | Writes bilingual (EN + BM) content with disclaimers |
| Compliance | ⚖️ | Reviews content + features against PDPA / MDA / T&CM Act |

## Pipelines

1. **Marketing → Compliance** — write then legal-review before publishing
2. **Dev → QA** — write code then review before merging
3. **Dev → QA → Compliance** — for patient-facing features touching health data
4. **Orchestrator (`auto`)** — given any task, routes to the right pipeline

## Setup

```bash
cd agents
npm install
export ANTHROPIC_API_KEY='sk-ant-...'   # bash/zsh
# or
$env:ANTHROPIC_API_KEY='sk-ant-...'     # PowerShell
# or
set ANTHROPIC_API_KEY=sk-ant-...        # cmd
```

## Usage

```bash
npm run marketing  -- "ginger benefits for digestion"
npm run code       -- "appointment booking form component"
npm run full       -- "patient photo upload with PDPA consent"
npm run auto       -- "write a post about tongue analysis"
```

Or invoke directly:

```bash
npx ts-node src/index.ts marketing "ginger tea benefits"
npx ts-node src/index.ts auto      "build a patient registration form"
```

## Output

Each run prints a session summary with:

- Number of API calls
- Input / output tokens used
- Estimated cost in USD (at Sonnet 4 pricing: $3/M input, $15/M output)
- Total wall-clock time

## Files

- `src/agents.ts` — role definitions + system prompts
- `src/caller.ts` — Anthropic API caller with retry + token tracking
- `src/pipelines.ts` — the four pipelines + orchestrator
- `src/index.ts` — CLI entry point
