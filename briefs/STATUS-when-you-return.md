# 🚀 Status — when you return

**Last updated:** 2026-05-05 (this session)
**Soft-launch ETA from now:** ~30-60 min of your time + ~3-4 hrs CC time

---

## ✅ What's done

### Brief 1A Phase 5 (D2 hybrid soft-delete) — **SHIPPED**

- Commit `d55926d` live on prod
- All 5 changes spot-checked: destroy(), restore(), deleteAll(), PurgeExpiredR2Tongues, BadgeController patch, scheduler config, routes, index include_trashed
- **Smoke test pending** — needs your fresh Sanctum token (the one in earlier chat history should be rotated for hygiene)

### 3 new briefs written and saved

- `briefs/brief-1A-phase-6-frontend-r2-upload.md` — ready to dispatch to CC
- `briefs/brief-1A-phase-8-pdpa-consent.md` — ready, but **legal copy needs your review first**
- `briefs/brief-1A-phase-9-hardening.md` — sequenced for pre/post launch

---

## 🎯 Critical path to soft launch

Do these in order:

### 1. Verify Phase 5 (5 min)

Get a fresh Sanctum token (DevTools → Network → any request → copy `Authorization: Bearer ...`). Paste to me. I run the curl smoke test from my sandbox:

```bash
# (I'll run these for you — just need the token)
DELETE /api/patient/tongue-assessments/<id>           → expect ok + recoverable_until
GET    /api/patient/tongue-assessments?include_trashed=true  → expect deleted row visible with deleted_at
POST   /api/patient/tongue-assessments/<id>/restore   → expect ok + restored
DELETE /api/patient/tongue-assessments (bulk + confirm) → expect deleted_count
```

### 2. Ship Brief 1A Phase 6 (~45 min CC time)

Single-file frontend change. CC prompt:

```
Execute Brief 1A Phase 6 ONLY. Stop after committed and pushed.
Brief: E:\Hansmed-system\briefs\brief-1A-phase-6-frontend-r2-upload.md
Pre-flight + scope are documented. Reach for those, not pseudocode in the brief, if anything's ambiguous.
Stop and report:
- Diff of v2/assets/js/api.js
- Confirmation that ai-diagnosis.js + tongue.js are NOT touched
- Suggested smoke test (browser DevTools workflow)
Wait for my approval before Phase 8.
```

After CC ships → manual smoke test in browser → confirm 3 network calls (start-upload, R2 PUT, complete-upload) → approve.

### 3. ⚠️ REVIEW Brief 1A Phase 8 legal copy (30-60 min YOUR time)

**Don't dispatch Phase 8 to CC until you've done this.**

Open `briefs/brief-1A-phase-8-pdpa-consent.md`. Review:

- ✅ `CONSENT_TEXT_EN` and `CONSENT_TEXT_ZH` — the binding consent language
- ✅ Privacy policy sections 1-12 — scaffold copy (sections 5-12 are templated, you fill in)
- ✅ Cross-border transfer disclosure (PDPA Section 39) — confirm Anthropic policy link
- ✅ Retention period for soft-deleted metadata (5y? 7y?) — Malaysian healthcare regs vary
- ✅ Legal address, DPO email

**Strongly recommended**: 1-hr Malaysian lawyer consultation (~RM 500-1500). For a healthcare product touching cross-border AI, this is cheap insurance.

### 4. Ship Brief 1A Phase 8 (~1.5-2 hrs CC time, after legal review)

Once you've edited the consent texts to your final language:

```
Execute Brief 1A Phase 8 ONLY. Stop after each part — there are 5 parts:
  Part 1: consent-modal.js component
  Part 2: api.js consent_text wiring
  Part 3: ai-diagnosis.js (and tongue.js) consent gate
  Part 4: v2/privacy.html (DO NOT INVENT LEGAL TEXT — use the brief's drafts as starting point AS-IS, user has reviewed them)
  Part 5: Settings → Privacy → Delete All UI

Brief: E:\Hansmed-system\briefs\brief-1A-phase-8-pdpa-consent.md
After each part, stop and report. Wait for my "next" before continuing.
```

### 5. Quick smoke test of consent flow (5 min)

Browser incognito → upload tongue → see modal → check box → continue → assessment uploads with consent_text populated.

### 6. Ship Brief 1A Phase 9 Item 2 only — ContentLength enforcement (15 min CC)

Pre-launch must-have:

```
Execute Brief 1A Phase 9 — Item 2 ONLY (ContentLength enforcement).
Brief: E:\Hansmed-system\briefs\brief-1A-phase-9-hardening.md
Stop after committed. Items 1, 3, 4, 5 are post-launch.
```

### 7. Pre-launch final checklist

- [ ] All 4 v3 marketing pages load on hansmedtcm.com (already verified)
- [ ] Patient portal AI Wellness Assessment full flow works (upload + analyze + see constitution)
- [ ] Consent modal appears for new patient
- [ ] Privacy Policy page reachable from consent modal
- [ ] "Delete All My Tongue Data" works in Settings → Privacy
- [ ] Doctor's review queue shows new assessments (not soft-deleted ones)
- [ ] BadgeController doesn't show ghost badge counts after a delete
- [ ] Cloudflare R2 bucket has objects appearing as patients upload

### 8. 🚀 Soft launch

Phase 9 Items 1, 3, 4, 5 happen after launch. Cron service registration (Item 1) within first 7 days so the first batch of expired rows actually gets purged.

---

## ⏰ Time accounting

| Step | Time |
|---|---|
| Phase 5 smoke test | 5 min (your time) |
| Phase 6 CC ship + your verify | 45 + 5 min |
| Phase 8 legal review | 30-60 min (your time, BLOCKS shipping) |
| Phase 8 CC ship + smoke | 90 + 10 min |
| Phase 9 Item 2 (pre-launch) | 15 min CC + 5 min verify |
| Pre-launch checklist | 15 min (your time) |
| **Total your active time** | **~75-110 min** |
| **Total CC time** | **~3 hrs** |

If you skip the legal review (NOT recommended), it drops to ~45 min your time + 3 hrs CC. But then you're shipping Phase 8 with my drafted legal text, which is risky.

---

## ⚠️ Outstanding decisions you need to make

1. **Will you get a Malaysian lawyer to review the consent + privacy copy?**
   - Yes (recommended, ~RM 500-1500) → schedule before Phase 8
   - No (accept the risk) → review the drafts yourself carefully and ship

2. **Soft launch date** — when do you want to flip the switch?
   - Today/tomorrow (aggressive) → Phase 6 + 8 must ship today
   - This week → comfortable
   - Next week → can do Phase 9 fully before launch

3. **Phase 7 (single-delete undo UI in patient portal)**
   - We dropped this from Brief 1A scope. Patient can soft-delete (backend works), but there's no "Recently Deleted" list view yet.
   - Options:
     - Ship without it → patients get the 7-day undo via API only (frontend doesn't surface it; the only way to undo is asking support)
     - Add a small Phase 7.5 brief → Recently Deleted view in patient history (~2 hrs CC)
   - Recommendation: ship without it for soft launch. Add when you see deletion patterns.

4. **Phase 9 Item 1 (Railway cron service)** — when?
   - Pre-launch: nice to have, you can manually run weekly via `railway run` if you forget
   - Day 3-7 post-launch: must-have (otherwise R2 grows unbounded)

---

## 📂 File index

All briefs live in `E:\Hansmed-system\briefs\`:

- `brief-1A-r2-tongue-uploads.md` — original master brief (Phases 1-9)
- `brief-1A-phase-6-frontend-r2-upload.md` — NEW (this session)
- `brief-1A-phase-8-pdpa-consent.md` — NEW (this session, requires legal review)
- `brief-1A-phase-9-hardening.md` — NEW (this session, sequenced)
- `brief-21*` — domain switch + subpage hotfixes (all shipped)
- `brief-14a-fix-4-sticky-reduce.md` — constitution card patient-safety fix (shipped)

---

## 🤝 What I (Cowork) need from you on return

1. Fresh Sanctum patient token (paste in chat) — for Phase 5 smoke test via my sandbox
2. Approve me to proceed to Phase 6 (or have CC do it — your call per earlier discussion)
3. Read + approve Phase 8 legal copy (or take it to a lawyer)
4. Decisions on the 4 outstanding items above

---

## 💡 Things to think about over your break

- Marketing copy for soft launch — we didn't touch this. Who's writing the launch tweet/post/WhatsApp message?
- Initial test patients — have you lined up 5-20 people to onboard in week 1?
- Pricing — when freemium? Brief #20 (freemium implementation) was queued earlier. Probably week 2-3.
- Doctor onboarding — practitioners need accounts. Have they all registered?
- Support inbox — `hello@hansmedtcm.com` (Brief #22 noted email routing follow-up)

These aren't blockers, but they'd be unforced errors to launch without addressing.

---

⚠️ **What I did NOT do while you were away:**

- ❌ Push any code (only briefs, no production changes)
- ❌ Run any Railway commands (no auth, and shouldn't)
- ❌ Make legal copy decisions (flagged everywhere with [USER REVIEW])
- ❌ Drive your PC via computer-use unattended (declined for safety)
- ❌ Use your tokens for anything

Welcome back. 🌱
