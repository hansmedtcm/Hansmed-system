# HansMed Modern TCM — Claude Operating Guide

**Owner:** HansMed
**Project root:** `E:\Hansmed-system\`
**This file is a behavior contract, not a wishlist.** Rules below exist because real failure modes matter. Keep under 200 lines (compliance drops above that — Anthropic guidance).

**Private operational details — incident specifics, current state, sensitive failure modes — live in `_internal/CLAUDE_OPS.md` (gitignored). Read both if present.**

---

## Mission

**Short-term:** A licensed TCM telehealth platform for Malaysia — patient/doctor/pharmacy portals, AI-assisted tongue diagnosis, online consultations, prescription fulfilment.

**Long-term:** Hospital-grade healthcare system with HL7 FHIR R4 + LOINC + ICD-10 interoperability, PDPA + MDA 2012 + T&CM Act 2016 + MMC telemedicine compliance, HMAC-chained audit logs, PHI encryption at rest.

---

## Stack (DO NOT propose alternatives without explicit user request)

- **Backend:** Laravel 11 + Sanctum + MySQL + PHP 8.3 + Composer
- **Hosting:** Railway (backend) + GitHub Pages (frontend) + Cloudflare DNS
- **Backend runs as:** `php artisan serve` (not nginx/php-fpm/Octane)
- **Frontend:** Vanilla JS, no framework. Pages and assets live at the repo root (`index.html`, `assets/js/...`, etc.) after the 2026-05-17 consolidation. Pre-consolidation history is under the `pre-v2-consolidation-2026-05-17` tag if a v2-era ref needs lookup.
- **Domain:** `hansmedtcm.com` → GH Pages. Backend at `https://hansmed-system-production.up.railway.app/api`.
- **Repo:** Public on GitHub. ALL tracked files are publicly readable.

---

## Hard Constraints

1. **Do not set `CACHE_STORE=redis`.** Redis may be provisioned but `predis` is not in `composer.json`. Leave the env unset (defaults to `file` per `backend/config/cache.php` line 4), or set explicitly to `file`. Any new code calling `Cache::remember`, `Cache::store('redis')`, etc. is also off-limits until `predis` is installed.
2. **Railway only redeploys when `/backend/**` changes.** Build config in `backend/nixpacks.toml`. Frontend or root-level changes trigger GH Pages, not Railway. Plan deploys accordingly.
3. **Repo is PUBLIC.** Anything in the working tree is served at `https://hansmedtcm.com/<path>` once committed. Never commit internal docs, audit reports, briefs, handoff docs, backup files (`*.bak`, `*-old.*`, `*.pre-*`), `*.local.*`, raw schema dumps, or whole directories of internal notes. Use `_internal/` (gitignored) for those.
4. **Frontend lives at the repo root (consolidated 2026-05-17).** The pre-consolidation `v2` and `v3` directories no longer exist. Pre-consolidation path refs should be updated to root paths; pre-2026-05-17 history is preserved under the `pre-v2-consolidation-2026-05-17` tag.
5. **Octane / FrankenPHP migration is off the table** unless the user explicitly asks. Previous attempt broke CORS.
6. **Build accordingly for a small team.** Don't propose features that require a 5-person team to maintain.

---

## Behavior Rules

### From the Karpathy + community CLAUDE.md framework (picked subset)

**R1 — Think before writing.** State your assumptions. If unsure, ask. Don't guess.

**R2 — Simplicity first.** Use the least code that solves the problem. Don't add unused features or speculative abstractions.

**R3 — Surgical changes only.** Modify only what the task requires. Do not bundle hygiene cleanups, renames, or unrelated tidying into a commit.

**R4 — Goal-oriented execution.** Define success criteria upfront. Iterate until met.

**R5 — Failure must be explicit.** Never silently swallow an error and report success. Log it; surface it; let the user decide.

**R6 — Respect existing style.** Match the codebase's naming, indentation, file structure, and patterns. New file → read 2–3 neighbours first.

### HansMed-specific operational rules

**H1 — Strangler Fig refactor is locked.** Do not propose from-scratch rewrites. Preserve working code; restructure or replace only what's broken or missing.

**H2 — No raw shell heredocs for editing PHP/JS files.** They escape-pollute string literals. Use the Edit tool directly.

**H3 — Non-ASCII content (Chinese characters, emojis) breaks naive edits.** Use surgical Edit with sufficient context, or Write to rewrite entire small files. Never use shell `sed`/`awk` on these files.

**H4 — Audit before `git add -A`.** Repo root accumulates untracked items that should never be committed (backup files, internal directories). Always stage explicit file lists. Before any commit, run `git ls-files | grep -E '(-old\.|\.bak|\.pre-|\.local\.json$)'` — any match is a banned-pattern leak that must be resolved (move to `_internal/`, `git rm --cached`, or update `.gitignore`) before the commit lands.

**H5 — Agent team pattern for high-stakes work.** Any change touching >2 files, security/auth, schema migrations, frontend path changes, or hosting config → spawn at minimum a `code-reviewer`-prompted `general-purpose` agent before commit. Target default: `Plan + Explore + code-reviewer` running in parallel for significant tasks. **Discipline marker (Day 5 lesson):** before writing PHPUnit / integration tests, grep the codebase for the routes, middleware aliases, factory existence, model constants, and table schemas the tests will exercise. Tests built on assumed paths and assumed schemas are the most common reason CI is red on first run. Verify, then write — never the other way around. Specifically: HansMed's schema lives in `backend/database/schema.sql` (raw MySQL DDL), not in Laravel migrations — RefreshDatabase against sqlite in-memory will silently boot a 5-table test DB and every feature test that touches `audit_logs`, `prescriptions`, `appointments` etc. will fail at the SQL layer.

**H6 — Test accounts in prod are temporary.** Any test account encountered should be rotated short-term; full removal in scheduled hygiene passes.

**H7 — Favour small surgical commits over big restructures.** Speculative changes tend to get reverted. Small commits ship; big restructures revert.

**H8 — Cowork sandbox views are unreliable; trust Windows-side git.** Both the bash workspace (FUSE-mounted) and the Read tool have been observed showing stale or truncated content for files that are actually intact on disk (seen multiple times Day 6 and at Day 7 start on `schema.sql`, `bootstrap/app.php`, `admin.html`, `index.html`, `routes/api.php`). Whenever a sandbox-side check disagrees with a Windows-side `git status` / `git diff`, the Windows side wins. Cheap verification at session start: ask the user to run `git status` from Claude Code (PowerShell) and trust that as ground truth before believing any sandbox-side diff. Same rule applies mid-session whenever truncation or "missing content" is suspected — the recovery recipe in H3's working-tree-truncation section is good to keep handy but most "truncation" sightings turn out to be cache illusions.

---

## Recurring Failure Patterns (generic)

- **PHP shell heredoc escape pollution** — `\'` invading string literals. Fix: use Edit tool, not shell heredocs.
- **File truncation on Edit with non-ASCII content** — Files lose closing braces/tags mid-string. Restore from git if seen.
- **Working-tree truncation without index modification** — Edit/Write on long mixed-content files can leave the working-tree file truncated mid-string while git index + HEAD remain intact, so `git status` flags it as `M` rather than as missing. Observed twice on Day 2: (a) `outputs/99-back-matter.md` stuck at 2698 bytes mid-sentence after re-Write, (b) `backend/{Dockerfile, routes/api.php, app/Models/PatientProfile.php, app/Http/Controllers/Admin/MigrationController.php}` all truncated 60–99% the way through with no closing braces. The next `git add -A` would have shipped broken PHP and a broken Dockerfile to Railway. **Detection recipe** before any commit: `for f in $(git diff --name-only); do WT=$(stat -c%s "$f"); H=$(git cat-file -p HEAD:"$f" | wc -c); echo "$f WT=$WT HEAD=$H"; done` — large negative deltas with a tail that ends mid-token are the tell. **Recovery recipe** (sandbox-safe, no index touch): `git cat-file -p HEAD:path/to/file > path/to/file` then `sed -i 's/$/\r/' path/to/file` to restore CRLF for Windows working tree.
- **Cache::* calls touching Redis** — see Hard Constraints rule 1.
- **Revert cascade in git history** — `git log --oneline` of recent weeks shows multiple `Revert "..."` commits. Large or speculative changes get rolled back within days. Reinforces R3 (surgical) and H1 (Strangler Fig). If a change feels big enough to push as one commit, that's the signal to split it.
- **Grep that misses `orWhere`** — searching `where\(['"]field['"]` is incomplete; Laravel also uses `orWhere`, `whereRaw`, `->when(...->where(...))`, and chained builder methods. Before claiming "zero WHERE-clause usage" on a field (matters before adding encryption casts, soft-delete scopes, etc.), grep wider: `grep -rn 'field_name' --include='*.php' app/` and inspect every hit.

---

## The 12-Week Strangler Fig Plan

- **Week 1** — Frontend consolidation (v2 → root, remove v3); CI/CD (PHPUnit + node --check on push); smoke tests; private `hansmed-ops` repo for env var management.
- **Week 2** — PHI encryption via Laravel `encrypted` casts; audit log hash chain; Sentry observability.
- **Weeks 3–8** — Domain extraction into `app/Domains/{Appointments,Auth,Clinical,Pharmacy,Audit,Consent}/`.
- **Weeks 9–12** — Compliance documentation (PDPA, MDA, T&CM Act, MMC) + first external pen test prep.

---

## How a New Cowork Chat Picks Up Work

1. Read this file (you're doing it).
2. Read `_internal/CLAUDE_OPS.md` if present (sensitive operational specifics).
3. Run `git status` — flag any unexpected dirty state to the user before touching anything.
4. Run `git log --oneline -5` — see the actual current HEAD.
5. Run TaskList tool to see open work; check `TASKS.md` if present.
6. Ask the user what they want to work on today. Don't assume.
7. Use the agent team pattern (H5) by default for anything non-trivial.

---

## User Preferences (active across all sessions)

- **Warn when a request is close to violating Claude's Usage Policy.**
- **Business context:** Malaysian TCM telehealth + e-commerce; give good/bad outcomes for strategic decisions.
- **For coding work, give 2–3 options with rationale.** User picks.
- **Tone:** direct, paragraph-driven; structured when needed but not over-bulleted.
- **Language:** English primarily; bilingual labels (English · 中文) where the codebase already uses them.

---

## Agent Team Reference

Available in Cowork via the Task / Agent tool:

- **Plan** — architect for implementations and migrations.
- **Explore** — read-only codebase search.
- **general-purpose** — briefed with role prompts: `code-reviewer`, Compliance Auditor, QA Tester, Security Auditor, Senior Laravel Engineer, etc.

**Pattern:** Lead Claude builds; specialist agents review/plan/search in parallel; lead synthesizes and presents to user. Each agent is stateless — brief them fully. See `_internal/CLAUDE_OPS.md` for typical briefing templates.

---

**End of contract.** When this file approaches 200 lines, prune ruthlessly. A 150-line file that reflects real failure modes beats a 300-line file with aspirational generalities.
