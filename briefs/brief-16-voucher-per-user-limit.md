# Brief #16 — Voucher per-user usage limit (configurable, default 1)

**Classification: BACKEND + ADMIN UI — scope: add per-user redemption tracking to the existing voucher system. Configurable "Max uses per person" field (default 1). Includes admin "Used by" expandable view to see who has redeemed each voucher. Race-condition safe via database transaction.**

## Background

CEO confirmed the soft launch will use shared voucher codes (e.g., one `TESTER2026MAY` code distributed to all testers) but each tester should only be able to use it ONCE. The current voucher system tracks total redemptions but not per-user redemptions — so a single tester could exhaust the entire `max_redemptions` cap by themselves.

**Existing system (verified by code read):**
- Admin panel: `v2/assets/js/panels/admin/vouchers.js` — full CRUD UI exists
- Backend service: `backend/app/Services/VoucherService.php` — `preview()` validates, `recordRedemption()` increments total counter
- Backend controller: `backend/app/Http/Controllers/Admin/VoucherController.php` — admin REST endpoints
- Database: `vouchers` table with `code`, `discount_pct`, `valid_from`, `valid_until`, `max_redemptions`, `redemption_count`, `applies_to`, `is_active`, `description`

**What's missing:** per-user tracking. Need to know "has this specific user already redeemed this voucher, and if so how many times?"

**CEO's chosen scope:** configurable "Max uses per person" field that admin sets per voucher, default `1`. Plus admin visibility into which users have redeemed each voucher.

## TASK A — Database migration: voucher_redemptions table + per_user_limit column

Create a new migration: `backend/database/migrations/[YYYY_MM_DD]_create_voucher_redemptions_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Per-user redemption log. Source of truth for "has this user
        // redeemed this voucher and how many times?". The denormalised
        // total counter on vouchers.redemption_count stays for backward
        // compatibility and admin display.
        Schema::create('voucher_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained('vouchers')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('ref_type', 32)->nullable();   // 'appointment' | 'order' | null
            $table->unsignedBigInteger('ref_id')->nullable(); // appointment.id or order.id
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->timestamp('redeemed_at')->useCurrent();
            $table->timestamps();

            // Index for fast per-user lookups during preview()
            $table->index(['voucher_id', 'user_id']);
            // Index for admin "Used by" view
            $table->index(['voucher_id', 'redeemed_at']);
        });

        // Add per_user_limit column to existing vouchers table.
        // Default 1 = each user can redeem the voucher exactly once.
        // NULL = no per-user cap (legacy behaviour).
        Schema::table('vouchers', function (Blueprint $table) {
            $table->unsignedSmallInteger('per_user_limit')->default(1)->after('max_redemptions');
        });
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->dropColumn('per_user_limit');
        });
        Schema::dropIfExists('voucher_redemptions');
    }
};
```

**Note:** Default of `1` applies to NEW vouchers. Existing vouchers in the database keep their default value too (the migration's `default(1)` applies on column add). This means existing tester voucher you've already created will become "1 per user" — confirm with CEO if any existing voucher should be unlimited per user (set explicitly to NULL via admin edit).

Run the migration:
```bash
cd /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/backend
php artisan migrate
```

## TASK B — Eloquent model

Create `backend/app/Models/VoucherRedemption.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoucherRedemption extends Model
{
    protected $fillable = [
        'voucher_id',
        'user_id',
        'ref_type',
        'ref_id',
        'discount_amount',
        'redeemed_at',
    ];

    protected $casts = [
        'discount_amount' => 'decimal:2',
        'redeemed_at'     => 'datetime',
    ];

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

If a `Voucher` model exists in `backend/app/Models/`, add the inverse relationship:
```php
public function redemptions()
{
    return $this->hasMany(VoucherRedemption::class);
}
```

If no `Voucher` model exists (the service uses raw DB queries), skip this — VoucherService can use DB query builder directly.

## TASK C — Update VoucherService

Edit `backend/app/Services/VoucherService.php`:

### C1 — Update `preview()` to check per-user limit

Add a `$userId` parameter to `preview()`. After the existing total-redemption check, add a per-user check:

```php
public function preview(string $code, float $amount, string $scope, ?int $userId = null): array
{
    // ... existing code unchanged through the max_redemptions check ...

    if ($v->max_redemptions && $v->redemption_count >= $v->max_redemptions) {
        return ['ok' => false, 'message' => 'Voucher fully redeemed.', 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
    }

    // === NEW: per-user limit check ===
    if ($userId && $v->per_user_limit !== null) {
        $userRedemptions = DB::table('voucher_redemptions')
            ->where('voucher_id', $v->id)
            ->where('user_id', $userId)
            ->count();
        if ($userRedemptions >= $v->per_user_limit) {
            $msg = $v->per_user_limit === 1
                ? 'You have already used this voucher.'
                : 'You have reached the use limit for this voucher (' . $v->per_user_limit . ' uses).';
            return ['ok' => false, 'message' => $msg, 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
        }
    }
    // === END NEW ===

    if ($v->applies_to !== 'all' && $v->applies_to !== $scope) {
        return ['ok' => false, 'message' => 'Voucher not valid for this purchase type.', 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
    }

    // ... existing discount calculation unchanged ...
}
```

### C2 — Update `recordRedemption()` to insert per-user row + use transaction

Replace the existing `recordRedemption()` with:

```php
/**
 * Atomically record a voucher redemption.
 * Inserts a row in voucher_redemptions AND increments the total counter
 * in vouchers.redemption_count, all within a single DB transaction.
 *
 * Re-checks per_user_limit inside the transaction to prevent race
 * conditions (concurrent requests both passing the preview check
 * before either has saved).
 */
public function recordRedemption(int $voucherId, int $userId, ?string $refType = null, ?int $refId = null, float $discountAmount = 0): array
{
    if (! Schema::hasTable('vouchers') || ! Schema::hasTable('voucher_redemptions')) {
        return ['ok' => false, 'message' => 'Voucher tables missing.'];
    }

    return DB::transaction(function () use ($voucherId, $userId, $refType, $refId, $discountAmount) {
        // Re-fetch voucher with row lock to prevent concurrent over-redemption
        $v = DB::table('vouchers')->where('id', $voucherId)->lockForUpdate()->first();
        if (! $v) {
            return ['ok' => false, 'message' => 'Voucher not found.'];
        }

        // Re-check total cap (in case other requests redeemed concurrently)
        if ($v->max_redemptions && $v->redemption_count >= $v->max_redemptions) {
            return ['ok' => false, 'message' => 'Voucher fully redeemed.'];
        }

        // Re-check per-user cap (race-condition guard)
        if ($v->per_user_limit !== null) {
            $userCount = DB::table('voucher_redemptions')
                ->where('voucher_id', $voucherId)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->count();
            if ($userCount >= $v->per_user_limit) {
                $msg = $v->per_user_limit == 1
                    ? 'You have already used this voucher.'
                    : 'You have reached the use limit for this voucher.';
                return ['ok' => false, 'message' => $msg];
            }
        }

        // Insert the per-user redemption row
        DB::table('voucher_redemptions')->insert([
            'voucher_id'      => $voucherId,
            'user_id'         => $userId,
            'ref_type'        => $refType,
            'ref_id'          => $refId,
            'discount_amount' => $discountAmount,
            'redeemed_at'     => now(),
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // Increment the denormalised total counter
        DB::table('vouchers')->where('id', $voucherId)
            ->update([
                'redemption_count' => DB::raw('redemption_count + 1'),
                'updated_at'       => now(),
            ]);

        return ['ok' => true, 'message' => 'Redemption recorded.'];
    });
}
```

### C3 — Update callers of preview() and recordRedemption()

Find all callers of `VoucherService::preview()` and `VoucherService::recordRedemption()`:

```bash
grep -rn "VoucherService\|preview(.*scope\|recordRedemption" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/backend/app/
```

Each caller needs to:
- Pass `$userId` (typically `auth()->id()` or `$request->user()->id`) to `preview()`
- Pass `$userId`, `$refType`, `$refId`, `$discountAmount` to `recordRedemption()`

Likely callers (verify via grep above):
- `backend/app/Http/Controllers/Patient/OrderController.php`
- `backend/app/Http/Controllers/Patient/AppointmentController.php` (if exists)
- Any "validate voucher" public endpoint

For the public preview endpoint (when patient enters voucher in checkout to see discount), pass the authenticated user's ID:

```php
// Old:
$result = $voucherService->preview($code, $amount, 'order');

// New:
$result = $voucherService->preview($code, $amount, 'order', $request->user()?->id);
```

For the apply-after-payment call:
```php
// Old:
$voucherService->recordRedemption($voucher->id);

// New:
$voucherService->recordRedemption(
    $voucher->id,
    $request->user()->id,
    'order',                  // or 'appointment'
    $order->id,               // or $appointment->id
    $discountAmount           // actual amount discounted
);
```

## TASK D — Admin form: add "Max uses per person" field

Edit `v2/assets/js/panels/admin/vouchers.js`. In `openEditModal()`, find the field-grid containing "Max Redemptions" and add a new field next to it:

Find:
```js
      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label" data-required>Discount % · 折扣百分比</label>' +
      '<input name="discount_pct" type="number" min="0.01" max="100" step="0.01" class="field-input field-input--boxed" value="' + (d.discount_pct || '10') + '" required></div>' +
      '<div class="field"><label class="field-label">Max Redemptions · 使用上限</label>' +
      '<input name="max_redemptions" type="number" min="1" class="field-input field-input--boxed" value="' + (d.max_redemptions || '') + '" placeholder="Leave blank = unlimited"></div>' +
      '</div>' +
```

Replace with:
```js
      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label" data-required>Discount % · 折扣百分比</label>' +
      '<input name="discount_pct" type="number" min="0.01" max="100" step="0.01" class="field-input field-input--boxed" value="' + (d.discount_pct || '10') + '" required></div>' +
      '<div class="field"><label class="field-label">Max Redemptions · 總使用上限</label>' +
      '<input name="max_redemptions" type="number" min="1" class="field-input field-input--boxed" value="' + (d.max_redemptions || '') + '" placeholder="Leave blank = unlimited"></div>' +
      '</div>' +

      // NEW: per-user limit
      '<div class="field"><label class="field-label">Max Uses Per Person · 每人使用次數上限</label>' +
      '<input name="per_user_limit" type="number" min="1" class="field-input field-input--boxed" value="' + (d.per_user_limit !== undefined && d.per_user_limit !== null ? d.per_user_limit : '1') + '" placeholder="Leave blank = unlimited per person">' +
      '<div class="text-xs text-muted" style="margin-top:4px;">Default 1 means each user can use this code only once. Set to higher number for multi-use codes; leave blank to remove the per-person cap.</div>' +
      '</div>' +
```

In the form submission handler (after `var data = HM.form.serialize(form);`), add:
```js
      if (! data.per_user_limit || data.per_user_limit === '') {
        data.per_user_limit = null;  // null = unlimited per person
      } else {
        data.per_user_limit = parseInt(data.per_user_limit, 10);
      }
```

## TASK E — Admin list: add "Per Person" column + "Used by" expandable row

Edit the table header in `load()` (around line 49-52). Find:
```js
      container.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Code</th><th>Discount</th><th>Scope</th><th>Valid</th>' +
        '<th>Used / Cap</th><th>Status</th><th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
```

Replace with:
```js
      container.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Code</th><th>Discount</th><th>Scope</th><th>Valid</th>' +
        '<th>Total Used / Cap</th><th>Per Person</th><th>Status</th><th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
```

Update the row rendering in the `rows.forEach` block. Find the existing `tr.innerHTML = ...` block and add a `Per Person` cell + a "Used by" expandable row beneath each voucher row:

```js
      rows.forEach(function (v) {
        var validRange = (v.valid_from || '—') + ' → ' + (v.valid_until || '—');
        if (!v.valid_from && !v.valid_until) validRange = '<span class="text-muted">always</span>';
        var usage = v.redemption_count + ' / ' + (v.max_redemptions || '∞');
        var perPersonLabel = (v.per_user_limit === null || v.per_user_limit === undefined) ? '∞' : String(v.per_user_limit);
        var statusBadge = v.is_active
          ? '<span class="badge badge--success">Active</span>'
          : '<span class="badge">Inactive</span>';
        var scopeLabel = { all: 'All', appointment: 'Appointment', order: 'Order' }[v.applies_to] || v.applies_to;

        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><strong style="font-family:var(--font-mono);font-size:13px;">' + HM.format.esc(v.code) + '</strong>' +
          (v.description ? '<div class="text-xs text-muted">' + HM.format.esc(v.description) + '</div>' : '') + '</td>' +
          '<td><strong style="color:var(--gold);">' + parseFloat(v.discount_pct) + '%</strong></td>' +
          '<td>' + scopeLabel + '</td>' +
          '<td class="text-xs">' + validRange + '</td>' +
          '<td>' + usage + '</td>' +
          '<td class="text-xs">' + perPersonLabel + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="text-align:right;">' +
          '<button class="btn btn--ghost btn--sm" data-usedby>Used by</button> ' +
          '<button class="btn btn--ghost btn--sm" data-edit>Edit</button> ' +
          '<button class="btn btn--ghost btn--sm" data-del style="color:var(--red-seal);">Delete</button>' +
          '</td>';
        tr.querySelector('[data-edit]').addEventListener('click', function () { openEditModal(v); });
        tr.querySelector('[data-del]').addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Delete voucher ' + v.code + '? · 確認刪除？', { danger: true });
          if (! ok) return;
          try { await HM.api.admin.deleteVoucher(v.id); HM.ui.toast('Deleted · 已刪除', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });
        tr.querySelector('[data-usedby]').addEventListener('click', function () {
          openUsedByModal(v);
        });
        tbody.appendChild(tr);
      });
```

Add a new `openUsedByModal()` function below `openEditModal()`:

```js
  async function openUsedByModal(v) {
    try {
      var res = await HM.api.admin.listVoucherRedemptions(v.id);
      var redemptions = res.data || [];
      var content;
      if (! redemptions.length) {
        content = '<p class="text-muted">No one has used this voucher yet · 尚無人使用此優惠券</p>';
      } else {
        content = '<p class="text-xs text-muted mb-3">' + redemptions.length + ' redemption' + (redemptions.length === 1 ? '' : 's') + ' total.</p>' +
          '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>User</th><th>Email</th><th>Applied to</th><th>Discount</th><th>When</th>' +
          '</tr></thead><tbody>' +
          redemptions.map(function (r) {
            var refLabel = r.ref_type ? (r.ref_type + (r.ref_id ? ' #' + r.ref_id : '')) : '—';
            var userName = r.user_name || '(unknown)';
            return '<tr>' +
              '<td>' + HM.format.esc(userName) + '</td>' +
              '<td class="text-xs">' + HM.format.esc(r.user_email || '—') + '</td>' +
              '<td class="text-xs">' + HM.format.esc(refLabel) + '</td>' +
              '<td>RM ' + parseFloat(r.discount_amount || 0).toFixed(2) + '</td>' +
              '<td class="text-xs">' + HM.format.datetime(r.redeemed_at) + '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table></div>';
      }
      HM.ui.modal({
        size: 'lg',
        title: 'Used by · 使用記錄 — ' + v.code,
        content: content,
      });
    } catch (e) {
      HM.ui.toast(e.message || 'Failed to load redemptions', 'danger');
    }
  }
```

## TASK F — Backend endpoint for "Used by" data

Edit `backend/app/Http/Controllers/Admin/VoucherController.php`. Add a new method:

```php
/**
 * GET /api/admin/vouchers/{id}/redemptions
 *
 * List all redemptions of a voucher with user details.
 * Used by the admin "Used by" modal in the voucher list.
 */
public function listRedemptions(int $id)
{
    $rows = DB::table('voucher_redemptions as vr')
        ->leftJoin('users as u', 'u.id', '=', 'vr.user_id')
        ->where('vr.voucher_id', $id)
        ->orderByDesc('vr.redeemed_at')
        ->select(
            'vr.id',
            'vr.user_id',
            'vr.ref_type',
            'vr.ref_id',
            'vr.discount_amount',
            'vr.redeemed_at',
            'u.name as user_name',
            'u.email as user_email'
        )
        ->get();

    return response()->json(['data' => $rows]);
}
```

Add a route in `backend/routes/api.php` (find the existing admin voucher routes, add this beside them):
```php
Route::get('/admin/vouchers/{id}/redemptions', [App\Http\Controllers\Admin\VoucherController::class, 'listRedemptions']);
```

(Match the existing auth middleware/group around the other admin voucher routes.)

## TASK G — Frontend API client

Edit `v2/assets/js/api.js`. Find the `HM.api.admin` namespace (search for `listVouchers` or `createVoucher`). Add the new method:

```js
HM.api.admin.listVoucherRedemptions = function (voucherId) {
  return HM.api._request('GET', '/admin/vouchers/' + voucherId + '/redemptions');
};
```

(Match the existing `_request` helper signature used by the other admin API methods in the same file.)

## TASK H — Test scenarios

After deploy, run these manual tests in the doctor or admin account:

1. **Create test voucher via admin:**
   - Code: `TESTUSE1` · Discount: 100% · Max Redemptions: 10 · Per Person: 1 · Active ✓ · Save.

2. **Test single-use:**
   - Sign in as Patient A → book a consultation → enter `TESTUSE1` → discount applied, total RM 0.00 → confirm payment.
   - Try to book again with Patient A → enter `TESTUSE1` → expect error: "You have already used this voucher."

3. **Test multi-user:**
   - Sign in as Patient B (different account) → book a consultation → enter `TESTUSE1` → discount applies (because per-user limit is per-user, not shared).

4. **Test admin "Used by" view:**
   - Admin → Vouchers → click "Used by" on `TESTUSE1` row → modal shows Patient A and Patient B with timestamps and discount amounts.

5. **Test per-person limit > 1:**
   - Edit `TESTUSE1` → set Per Person to 3 → save.
   - Patient A redeems again → succeeds (now total 2 of 3 for this user).
   - Patient A redeems again → succeeds (now 3 of 3).
   - Patient A redeems 4th time → expect error: "You have reached the use limit for this voucher (3 uses)."

6. **Test unlimited per-person:**
   - Edit voucher → blank out Per Person field → save → admin list shows ∞ in Per Person column.
   - Patient A can redeem multiple times until total `max_redemptions` cap hits.

## ACCEPTANCE CRITERIA

- Migration creates `voucher_redemptions` table and adds `per_user_limit` column to `vouchers` (default 1)
- `VoucherService::preview()` accepts `$userId` parameter and rejects if user has hit per-user cap
- `VoucherService::recordRedemption()` inserts per-user row and increments total counter, all in a transaction with row locks (race-condition safe)
- All controllers calling preview/recordRedemption pass the authenticated `user_id`
- Admin form shows "Max Uses Per Person" field with default value 1, helper text explaining what it does
- Admin list shows "Per Person" column (numeric or ∞)
- Admin list has "Used by" button that opens a modal with all redemptions of that voucher (user name, email, ref, discount, date)
- Backend endpoint `GET /api/admin/vouchers/{id}/redemptions` returns the redemption list
- All 6 test scenarios above pass
- Bilingual labels (EN · 中) preserved on admin form
- Existing vouchers automatically get `per_user_limit = 1` after migration (CEO can edit any voucher to set unlimited via the admin form)

## REPORT BACK

```
Files modified:
  - backend/database/migrations/[timestamp]_create_voucher_redemptions_table.php  (NEW)
  - backend/app/Models/VoucherRedemption.php  (NEW)
  - backend/app/Services/VoucherService.php
  - backend/app/Http/Controllers/Admin/VoucherController.php
  - backend/routes/api.php
  - v2/assets/js/panels/admin/vouchers.js
  - v2/assets/js/api.js
  - (callers of preview/recordRedemption — list which were updated)

Pushed to: [commit hash]
Migration ran cleanly: [yes/no]
Existing vouchers got per_user_limit = 1: [yes/no — verify with SELECT]

Test scenarios:
  1. Voucher created with per_user_limit = 1: [pass/fail]
  2. Same user can't use twice: [pass/fail]
  3. Different user CAN use: [pass/fail]
  4. Admin "Used by" view shows redemptions: [pass/fail]
  5. Per Person limit = 3 works: [pass/fail]
  6. Blank Per Person = unlimited: [pass/fail]

Race-condition safety verified (transaction + lockForUpdate present): [yes/no]

Anything you noticed that needs CEO attention: [list]
```

## ROLLBACK

If anything breaks:
```bash
cd /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/backend
php artisan migrate:rollback
```
This reverses the migration (drops `voucher_redemptions`, removes `per_user_limit` column). Then revert the code changes via git. The existing voucher system continues working with total-only redemption tracking as before.

## NOTES

- The denormalised `redemption_count` field on `vouchers` is kept (not removed) for backward compatibility and fast admin display. The new `voucher_redemptions` table is the source of truth for per-user counts.
- Per-user limit enforcement is at the Laravel service layer with database transaction + row locking — race-condition safe under concurrent load.
- Default `per_user_limit = 1` matches CEO's stated need for tester FOC vouchers (one use per tester).
- Setting `per_user_limit` to NULL via the admin form (blank the field) means "no per-person cap" — only the total `max_redemptions` cap applies. Useful for general public promo codes that any user can use as many times as they want.
- This brief assumes the existing `users` table has `name` and `email` columns. Verify; if your user model uses different field names (e.g., `full_name`), adjust the `listRedemptions` query accordingly.
- Future enhancement (out of scope for this brief): per-user redemption analytics dashboard, voucher usage charts over time, automatic emailing testers their unique reminder when their use is consumed.
