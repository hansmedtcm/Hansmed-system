# Brief 1A Phase 9 — Hardening + Railway cron service

**Priority:** P1 — post-launch hardening (some items P0 if not done before launch)
**Estimated effort:** 2-3 hrs Claude Code + ~10 min user dashboard clicks
**Depends on:** Phases 1-8 shipped
**Blocks:** None (these are improvements, not launch blockers — but the cron service should be set up within 7 days of soft launch so the first batch of expired rows actually gets purged)

---

## Goal

Three hardening items that can ship together post-launch (or selectively pre-launch if time allows):

1. **Railway cron service** — register a scheduled service so `php artisan tongue:purge-expired-r2` runs daily at 03:00 UTC (currently the Laravel scheduler is wired but nothing invokes `schedule:run` on Railway)
2. **ContentLength enforcement** — server verifies the actual R2 object size in `completeUpload`, rejects (and purges) if > 10 MB
3. **Orphan row cleanup** — new artisan command that soft-deletes `r2://pending` rows older than 24h, plus garbage-collects any R2 objects whose key isn't referenced in DB

---

## Item 1 — Railway cron service registration (USER STEP)

⚠️ Requires Railway dashboard access. CC cannot do this from a prompt.

### Steps

1. Go to https://railway.app → HansMed project → click "**+ New**" → **Empty Service**
2. Name the new service: `hansmed-cron`
3. Connect it to the same GitHub repo (`hansmedtcm/Hansmed-system`)
4. Settings → **Build**:
   - Root Directory: `backend`
   - Builder: same as the web service (Dockerfile)
5. Settings → **Deploy**:
   - **Start Command**: `php artisan tongue:purge-expired-r2`
   - **Cron Schedule**: `0 3 * * *` (UTC — that's 11 AM Kuala Lumpur)
6. Settings → **Variables**: add the same env vars as the web service. Easiest path:
   - Go to the web service → Variables → use "Copy variable group" (Railway feature)
   - Or manually copy: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_REGION`, `DB_*`, `APP_KEY`, `APP_URL`, `APP_ENV=production`
7. Deploy. First deploy will:
   - Build the same way as the web service (uses same Dockerfile)
   - NOT start a long-running web server (start command override means it just runs the artisan command)
   - Exit immediately with status 0 (because there are no expired rows yet — soft-deleted rows are <7d old)
   - Then sit dormant until 03:00 UTC, when Railway re-runs the start command
8. Verify in Railway dashboard → `hansmed-cron` service → Deployments tab: should show "Cron schedule: every day at 03:00 UTC"

### Test the cron service manually

Once registered, you can trigger it on-demand without waiting for 03:00:

```bash
# From your machine:
railway service hansmed-cron
railway run php artisan tongue:purge-expired-r2
# Expected output (no expired rows yet): "0 candidates ... Purged 0 / 0. Failed 0."
```

### After ~10 days

Once you have soft-deleted assessments older than 7 days:
1. Wait for the 03:00 UTC run, OR trigger manually as above
2. Check Railway logs for the `hansmed-cron` service → should show "Purged N / N. Failed 0."
3. Verify in DB:
   ```sql
   SELECT COUNT(*) FROM tongue_assessments
   WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL 7 DAY AND r2_key IS NOT NULL;
   ```
   Should return 0 (all expired rows had r2_key nulled by the purge command).
4. Verify in Cloudflare R2 dashboard → bucket `hansmed-tongue-images` → object count should be approximately equal to the count of NON-soft-deleted rows.

### Failure mode + alerting

If the cron run fails (R2 unreachable, DB query fails), Railway logs the error and re-runs at next scheduled time. There's no built-in alerting in this brief.

If you want email-on-cron-failure, follow-up brief: integrate with Railway's webhook (or use a SaaS like Healthchecks.io that pings on missed runs).

---

## Item 2 — ContentLength enforcement (CC step)

### Why

Phase 3's signed URL doesn't enforce a max size at the R2 layer. A
malicious client could declare `file_size: 1024` (passes server-side
validation), receive the presigned URL, then PUT a 1 GB file to R2.
Cost is small (~$0.015/GB-month) but unwanted.

The cleanest defense is to verify the actual object size in
`completeUpload()` AFTER the PUT lands but BEFORE running the AI call,
and reject + purge the object if it's over the cap.

### File to modify

`backend/app/Http/Controllers/Patient/TongueAssessmentController.php`

### Change in `completeUpload()`

After the `Storage::disk('r2')->exists()` check (around line ~244 of
the controller, between the existence check and the `$assessment->update()` call):

```php
// Brief 1A Phase 9 — ContentLength enforcement.
// The presigned PUT URL doesn't enforce content-length-range, so
// verify the actual stored object size BEFORE running the AI call.
// 10 MB hard cap = 10 * 1024 * 1024 = 10485760 bytes (matches the
// max in start-upload's validation rule).
$actualSize = Storage::disk('r2')->size($assessment->r2_key);
if ($actualSize > 10485760) {
    // Purge the oversize object — patient declared a smaller size
    // and uploaded a larger one. Don't bill for AI processing.
    try { Storage::disk('r2')->delete($assessment->r2_key); } catch (\Throwable $e) {
        Log::warning('tongue_oversize_purge_failed', [
            'r2_key' => $assessment->r2_key,
            'size'   => $actualSize,
            'err'    => $e->getMessage(),
        ]);
    }
    $assessment->update([
        'image_url' => $assessment->image_url,    // leave as r2://pending so cleanup notices
        'status'    => 'failed',
    ]);
    return response()->json([
        'message' => 'Uploaded image exceeds 10 MB limit. Please retry with a smaller image.',
        'actual_size' => $actualSize,
    ], 422);
}
```

### Tests after deploy

- Patient declares file_size=1024, PUTs a 15 MB file → complete-upload returns 422 with the size error → R2 object purged
- Normal upload (5 MB) → completes successfully (no false positive on the cap)

---

## Item 3 — Orphan row cleanup (CC step)

### Why

A patient calls `start-upload` (row created with `image_url='r2://pending'`)
but never calls `complete-upload`. Could be: tab closed, network died,
patient changed their mind. Result: row stays in 'r2://pending' state
forever, optionally with an orphan R2 object (if the PUT actually
succeeded but complete-upload was never called).

### File to create

`backend/app/Console/Commands/PurgeOrphanTongueRows.php`

```php
<?php

namespace App\Console\Commands;

use App\Models\TongueAssessment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Brief 1A Phase 9 — Orphan tongue row cleanup.
 *
 * Soft-deletes rows that have been stuck in 'r2://pending' state for
 * more than 24 hours. These are leftovers from sessions where:
 *   - Patient called start-upload, never PUT to R2 (closed tab)
 *   - Patient called start-upload, PUT succeeded, but never called
 *     complete-upload (network dropped between step 2 and 3)
 *
 * For each orphan: try to delete the R2 object (might not exist if PUT
 * never happened — that's OK), then soft-delete the row. The 7-day R2
 * purge cron will eventually GC the soft-deleted row's r2_key.
 *
 * Run via:
 *   php artisan tongue:purge-orphans
 */
class PurgeOrphanTongueRows extends Command
{
    protected $signature   = 'tongue:purge-orphans';
    protected $description = 'Soft-delete tongue rows stuck in r2://pending state >24h';

    public function handle(): int
    {
        $cutoff = now()->subHours(24);
        try {
            $candidates = TongueAssessment::where('image_url', 'r2://pending')
                ->where('created_at', '<', $cutoff)
                ->get();
        } catch (\Throwable $e) {
            $this->error('DB query failed: ' . $e->getMessage());
            return self::FAILURE;
        }

        $total = $candidates->count(); $purged = 0; $failed = 0;
        $this->info(sprintf('[%s] tongue:purge-orphans — %d candidate%s (created_at < %s)',
            now()->toIso8601String(), $total, $total === 1 ? '' : 's', $cutoff->toIso8601String()));

        foreach ($candidates as $a) {
            // Best-effort R2 delete (the object might not exist if PUT never happened)
            if ($a->r2_key) {
                try {
                    Storage::disk('r2')->delete($a->r2_key);
                } catch (\Throwable $e) {
                    // Object probably doesn't exist — that's fine, log and continue
                    \Log::info('tongue_orphan_r2_delete_skipped', [
                        'r2_key' => $a->r2_key,
                        'reason' => $e->getMessage(),
                    ]);
                }
            }
            try {
                $a->delete();   // SoftDeletes — sets deleted_at
                $purged++;
                $this->line('  soft-deleted assessment ' . $a->id . ' (created ' . $a->created_at->toIso8601String() . ')');
            } catch (\Throwable $e) {
                $failed++;
                $this->warn('  FAILED to soft-delete assessment ' . $a->id . ' — ' . $e->getMessage());
            }
        }

        $this->newLine();
        $this->info(sprintf('Purged %d / %d. Failed %d.', $purged, $total, $failed));
        return self::SUCCESS;
    }
}
```

### Schedule it

Add to `bootstrap/app.php` `withSchedule()` block (alongside the existing
`tongue:purge-expired-r2` schedule):

```php
->withSchedule(function (Schedule $schedule) {
    $schedule->command('tongue:purge-expired-r2')->dailyAt('03:00');
    $schedule->command('tongue:purge-orphans')->dailyAt('03:30');   // <-- add this
})
```

### Add to Railway cron service (USER STEP)

The `hansmed-cron` service in Item 1 only runs ONE command per service.
Two options:

**Option A** (simpler, recommended): create a 2nd cron service `hansmed-cron-orphans` with start command `php artisan tongue:purge-orphans` and cron `30 3 * * *`. Same env vars, same image.

**Option B** (one service, multiple commands): change start command to `php artisan schedule:run` and cron `* * * * *` (every minute). Laravel's scheduler then runs whichever commands are due. This is the "proper" Laravel pattern but means Railway is invoking PHP every minute even when nothing's due. Tiny cost; cleaner long-term if you add more scheduled commands later.

**Recommendation: Option A for now (cheap and explicit), migrate to Option B if you add a 3rd scheduled command.**

---

## Item 4 — Remove github.io from R2 CORS (USER STEP, optional)

After 2-4 weeks of stable `hansmedtcm.com` operation, you can drop the
`https://hansmedtcm.github.io` entry from R2 CORS allowed origins.
Reduces the attack surface (one fewer origin that can request signed
PUTs against your bucket).

Two paths:

**Via Cloudflare dashboard** (manual, 30 sec):
- R2 → bucket → Settings → CORS Policy → edit JSON → remove the
  github.io line → Save

**Via artisan (if you've granted Admin scope on the R2 token)**:
- Edit `backend/app/Console/Commands/SetupR2Cors.php` → remove the
  github.io entry from `$allowedOrigins`
- `railway run php artisan r2:setup-cors`

Same change for backend's `backend/config/cors.php` — drop the
`'https://hansmedtcm.github.io'` line. Commit + push.

---

## Item 5 — Optional: lock down doctor-side raw queries (CC step)

Phase 5's pre-flight identified that `BadgeController` was patched
inline, but `Admin/MigrationController.php` lines 51, 288, 301, 347, 380
still have raw `DB::table('tongue_assessments')` queries that don't
filter `deleted_at`. These are admin-only one-shot scripts so impact is
low, but for consistency:

- Open each line, add `->whereNull('deleted_at')` to the query
- OR refactor to Eloquent (`TongueAssessment::query()`)

Estimated effort: 15-30 min. Not a launch blocker; a tidiness brief.

---

## Acceptance criteria

After Phase 9 ships:

1. **Cron service running** — Railway dashboard shows `hansmed-cron` (and optionally `hansmed-cron-orphans`) services, last run timestamp visible
2. **Manual purge works** — `railway run --service hansmed-cron php artisan tongue:purge-expired-r2` returns clean output
3. **ContentLength enforced** — uploading a 15 MB file via the new flow returns 422 with size error and the R2 object is purged
4. **Orphan cleanup works** — `tongue:purge-orphans` finds and soft-deletes any rows stuck in `r2://pending` state >24h
5. **github.io removed** (only after 2-4 weeks stable) — both R2 CORS and backend CORS drop the github.io entry; site continues working from hansmedtcm.com

---

## Commit messages (Items 2, 3, 5 are CC-driven; Items 1, 4 are USER dashboard work)

For Item 2 (ContentLength enforcement):
```
feat(backend): ContentLength enforcement on R2 uploads (Brief 1A Phase 9)

Verifies actual object size in completeUpload after PUT lands. If the
object is >10 MB, purges from R2 and returns 422 to client. Defends
against clients lying about file_size in start-upload.

Brief: 1A Phase 9 (Item 2)
```

For Item 3 (orphan cleanup):
```
feat(backend): tongue orphan-row cleanup command (Brief 1A Phase 9)

Adds php artisan tongue:purge-orphans which soft-deletes rows stuck in
r2://pending state for >24h. Schedules at 03:30 UTC daily alongside
the existing tongue:purge-expired-r2 (03:00).

Brief: 1A Phase 9 (Item 3)
```

For Item 5 (raw query cleanup, optional):
```
chore(backend): scope Admin/MigrationController raw queries to non-trashed (Brief 1A Phase 9)

Addition deferred from Phase 5 — adds whereNull('deleted_at') to the
five raw DB::table('tongue_assessments') queries in MigrationController.
Cosmetic consistency, no functional impact (these are admin-only fix scripts).

Brief: 1A Phase 9 (Item 5)
```

---

## Risks

- 🟢 Items 2 + 3 are pure backend additions — no schema changes, no breaking changes. Safe to ship anytime.
- 🟡 Item 1 (cron service) — first-time Railway service registration can take 5-10 min if you've never created an empty service before. The hardest part is finding the "Cron Schedule" field (Settings → Deploy → scroll down).
- 🟡 Item 4 (CORS lockdown) — if you remove github.io too early and someone hits an old bookmark, their tongue upload will fail. Wait the full 2-4 weeks.
- 🟢 Item 5 — purely cosmetic, lowest priority.

---

## Suggested sequencing

**If you want to ship Phase 9 in pieces**:

1. **Pre-launch** (must-have before patients land):
   - Item 2 — ContentLength enforcement (5 min CC)

2. **Day 1-3 post-launch**:
   - Item 3 — Orphan cleanup command (30 min CC)
   - Item 1 — Cron service registration (10 min user dashboard)

3. **Week 2-3 post-launch**:
   - Item 5 — Raw query cleanup (15-30 min CC)

4. **Week 3-4 post-launch**:
   - Item 4 — Remove github.io from CORS (5 min user dashboard)

---

## Out of scope for Phase 9

- Healthchecks.io / Sentry / etc. for cron failure alerting — separate brief
- Migrating to Option B (single cron service running `schedule:run`) — only worth it if you add a 3rd scheduled command
- Rate-limiting on start-upload (defense against patient flooding) — Laravel ratelimit middleware, separate brief
- Image-content scanning (verify uploaded image is actually a tongue, not e.g. someone's face) — could be Phase 4.5; falls outside Brief 1A scope

---

## Rollback per item

- Item 2: revert single commit in TongueAssessmentController. Risk goes back to "patient could lie about size".
- Item 3: drop the cron service from Railway dashboard. Keep the artisan command — it's just dormant.
- Items 1 + 4: pure dashboard / config changes — manually undo.
- Item 5: revert single commit in MigrationController.
