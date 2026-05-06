# Brief #15 — Google OAuth login

**Priority:** P1 — first item of Phase E2 (auth/email cluster)
**Estimated effort:** ~1.5–2 hrs Claude Code + ~10 min user dashboard clicks
**Depends on:** Phases 1A 5–9 shipped (existing Sanctum auth flow, user model, registration)
**Blocks:** Brief #16 (email verification + forgot-password) only because they share the auth surface — but technically independent

---

## Goal

Let patients (and later doctors) sign in with Google instead of email/password. This is the highest-leverage conversion improvement before launch:

- ~70% of Malaysian users have Gmail; one-tap sign-up vs. typing 5 fields
- Eliminates "forgot password" support tickets for OAuth users
- Email is auto-verified by Google (no need to send our own verification code for these users)

The flow: patient clicks "Continue with Google" on the landing-page auth modal → redirected to Google → grants permission → backend creates or finds the user, issues a Sanctum token, and redirects them into the portal already authenticated.

---

## Architecture decisions (locked)

| Decision | Choice |
|---|---|
| OAuth library | Laravel Socialite (`laravel/socialite`) |
| Redirect URI | `https://hansmed-system-production.up.railway.app/api/auth/google/callback` |
| Token return path | One-time exchange code → POST exchange for Sanctum token (avoids token in URL) |
| State (CSRF) | Stateless (`->stateless()->user()`) since backend is API-only across domains |
| Auto email-verify | Yes — Google has already verified the email, so set `email_verified_at = now()` |
| Account linking | If a user with the same email already exists (registered via password), link `google_id` to that account on first Google login |
| New `users` columns | `google_id VARCHAR(255) NULL UNIQUE`, `avatar_url VARCHAR(500) NULL` |
| Frontend button | "Continue with Google" on Login + Register tabs of the auth modal |

---

## Item 1 — Google Cloud Console setup (USER STEP, ~10 min)

⚠️ Must be done BEFORE backend code can be tested. CC can write all the code in parallel.

### Steps

1. Visit https://console.cloud.google.com → top-left project dropdown → **New Project**
   - Name: `HansMed Auth` (or anything memorable)
   - Click **Create**, wait ~30 sec for it to spin up
   - Make sure the new project is selected in the dropdown

2. Top search bar → search "OAuth consent screen" → click into it
   - **User Type**: External → Create
   - **App information**:
     - App name: `HansMed Modern TCM`
     - User support email: `hansmed.moderntcm@gmail.com`
     - App logo: optional, skip
   - **App domain**:
     - Application home page: `https://hansmedtcm.com`
     - Application privacy policy: `https://hansmedtcm.com/v2/privacy-policy.html` (file exists — verified earlier)
     - Application terms of service: skip if no terms page yet, otherwise `https://hansmedtcm.com/v2/terms.html`
     - Authorized domains: `hansmedtcm.com`
     - Developer contact: `hansmed.moderntcm@gmail.com`
   - Save and Continue
   - **Scopes**: skip — defaults (email + profile + openid) are exactly what we need
   - **Test users**: add your own email (`hansmed.moderntcm@gmail.com`) and any other emails you want to test with. While in "Testing" mode, only these users can log in. Publishing the app removes this limit (does require Google verification if scopes are sensitive — ours are not, so verification is auto-approved or skipped).
   - Save

3. Top search bar → "Credentials" → **+ Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `HansMed Web`
   - **Authorized redirect URIs** — add BOTH:
     - `https://hansmed-system-production.up.railway.app/api/auth/google/callback`
     - `http://localhost:8000/api/auth/google/callback` (for local dev, optional)
   - Click Create
   - **Save the Client ID + Client Secret** that appear in the modal — you'll paste them into Railway Shared Variables next

4. (When you're ready to launch publicly) → OAuth consent screen → **Publish App** → Confirm
   - Removes the "test users only" limit
   - Google will auto-approve since we only use basic scopes

### Find your Railway backend domain

- Open https://railway.app/dashboard → HansMed project → click `hansmed-backend` web service
- Settings → Networking → look for **Public Domain** (something like `hansmed-backend-production-xxxx.up.railway.app`)
- That domain goes into the Authorized redirect URI

---

## Item 2 — Backend: install + configure Socialite (CC STEP)

### 2a. Install package

```bash
cd backend
composer require laravel/socialite
```

This adds the package and auto-discovers the service provider.

### 2b. Add Google config to `backend/config/services.php`

Append inside the `return [...]` array:

```php
'google' => [
    'client_id'     => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect'      => env('GOOGLE_REDIRECT_URI'),
],
```

### 2c. Create the migration

```bash
php artisan make:migration add_google_columns_to_users
```

Migration file body:

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $t) {
        $t->string('google_id', 255)->nullable()->unique()->after('id');
        $t->string('avatar_url', 500)->nullable()->after('google_id');
    });
}

public function down(): void
{
    Schema::table('users', function (Blueprint $t) {
        $t->dropUnique(['google_id']);
        $t->dropColumn(['google_id', 'avatar_url']);
    });
}
```

### 2d. Update User model

`backend/app/Models/User.php` — add `google_id` and `avatar_url` to `$fillable`:

```php
protected $fillable = [
    // ...existing fields
    'google_id',
    'avatar_url',
];
```

### 2e. Create `AuthGoogleController`

`backend/app/Http/Controllers/Auth/AuthGoogleController.php`:

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

/**
 * Brief #15 — Google OAuth login.
 *
 * Three-step flow:
 *   1. /redirect  → bounces user to Google's consent screen
 *   2. /callback  → Google sends user back here with auth code; we
 *                   create-or-find the User and stash a one-time
 *                   exchange code → Sanctum token mapping in cache
 *   3. /exchange  → frontend POSTs the exchange code, gets the token
 *
 * Token never appears in a URL the browser can leak. Exchange code
 * has 60-second TTL and is single-use.
 */
class AuthGoogleController extends Controller
{
    public function redirect()
    {
        return Socialite::driver('google')
            ->stateless()
            ->redirect();
    }

    public function callback(Request $request)
    {
        try {
            $google = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable $e) {
            Log::warning('google_oauth_callback_failed', ['err' => $e->getMessage()]);
            return redirect(config('app.frontend_url', 'https://hansmedtcm.com')
                . '/v2/index.html?google_error=auth_failed');
        }

        // Look up by google_id first (cheapest path), then by email
        // (account-linking — patient registered via password, then
        // came back via Google with the same email).
        $user = User::where('google_id', $google->getId())->first();
        if (! $user) {
            $user = User::where('email', $google->getEmail())->first();
            if ($user) {
                // Link Google to existing account
                $user->google_id   = $google->getId();
                $user->avatar_url  = $google->getAvatar();
                if (! $user->email_verified_at) $user->email_verified_at = now();
                $user->save();
            } else {
                // Brand-new account
                $user = User::create([
                    'name'              => $google->getName() ?: $google->getEmail(),
                    'email'             => $google->getEmail(),
                    'google_id'         => $google->getId(),
                    'avatar_url'        => $google->getAvatar(),
                    'email_verified_at' => now(),  // Google verified it for us
                    'password'          => bcrypt(Str::random(32)),  // unusable random pwd
                    'role'              => 'patient',
                ]);
            }
        } else {
            // Existing google-linked user — refresh avatar in case it changed
            if ($google->getAvatar() && $google->getAvatar() !== $user->avatar_url) {
                $user->avatar_url = $google->getAvatar();
                $user->save();
            }
        }

        // Issue a Sanctum token + stash a one-time exchange code in cache
        $token = $user->createToken('google-oauth')->plainTextToken;
        $code  = Str::random(40);
        Cache::put('google_exchange:' . $code, [
            'user_id' => $user->id,
            'token'   => $token,
        ], now()->addSeconds(60));

        // Redirect to portal with the exchange code in the hash fragment
        // (hash is never sent to the server, so it doesn't leak via logs)
        $frontend = config('app.frontend_url', 'https://hansmedtcm.com');
        return redirect($frontend . '/v2/portal.html#/google-exchange?code=' . $code);
    }

    public function exchange(Request $request)
    {
        $request->validate(['code' => 'required|string|size:40']);
        $key = 'google_exchange:' . $request->code;
        $payload = Cache::pull($key);  // pull = read+delete (single-use)
        if (! $payload) {
            return response()->json(['message' => 'Code expired or invalid'], 400);
        }
        $user = User::find($payload['user_id']);
        if (! $user) {
            return response()->json(['message' => 'User not found'], 404);
        }
        return response()->json([
            'token' => $payload['token'],
            'user'  => [
                'id'         => $user->id,
                'name'       => $user->name,
                'email'      => $user->email,
                'avatar_url' => $user->avatar_url,
                'role'       => $user->role,
            ],
        ]);
    }
}
```

### 2f. Add routes

`backend/routes/api.php` — somewhere near the existing auth routes:

```php
// Brief #15 — Google OAuth
Route::get ('/auth/google/redirect', [\App\Http\Controllers\Auth\AuthGoogleController::class, 'redirect']);
Route::get ('/auth/google/callback', [\App\Http\Controllers\Auth\AuthGoogleController::class, 'callback']);
Route::post('/auth/google/exchange', [\App\Http\Controllers\Auth\AuthGoogleController::class, 'exchange']);
```

All three are public (no auth middleware) — the redirect + callback are unauthenticated by design, and `exchange` is protected by the one-time random code itself.

### 2g. Add `frontend_url` config

`backend/config/app.php` — somewhere in the `return [...]` array:

```php
'frontend_url' => env('FRONTEND_URL', 'https://hansmedtcm.com'),
```

---

## Item 3 — Frontend: "Continue with Google" button + exchange handler (CC STEP)

### 3a. Add the button to the auth modal

In `v2/index.html`, inside `<template id="tpl-auth-modal">`, add a divider + Google button in BOTH the login form and register form (so it's visible on whichever tab the user lands on).

After each tab's `<button type="submit" class="btn btn--primary btn--block">Sign In · 登入</button>` (or Register equivalent), insert:

```html
<div style="display:flex;align-items:center;gap:12px;margin:18px 0;">
  <div style="flex:1;height:1px;background:var(--border);"></div>
  <span style="font-size:12px;color:var(--stone);text-transform:uppercase;letter-spacing:0.08em;">or · 或</span>
  <div style="flex:1;height:1px;background:var(--border);"></div>
</div>
<button type="button" class="btn btn--block" data-action="google-oauth"
        style="background:#fff;border:1px solid var(--border);color:#3c4043;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:500;">
  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
  <span lang="en">Continue with Google</span><span lang="zh">使用 Google 繼續</span>
</button>
```

### 3b. Wire the button click in `landing.js`

Inside `openAuthModal()`, after the modal is built, add:

```js
// Brief #15 — Google OAuth button (present on every tab panel)
activeModal.element.querySelectorAll('[data-action="google-oauth"]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var apiBase = (window.HM_CFG && HM_CFG.apiBase) || HM.config.apiBase || '';
    window.location.href = apiBase + '/auth/google/redirect';
  });
});
```

(Adjust `HM.config.apiBase` to whatever the codebase already uses to reach the backend — verify by grepping for `apiBase` in `assets/js/config.js`.)

### 3c. Handle the exchange route in the portal

In the portal's hash router (`v2/portal.html` or wherever the SPA router lives), add a route for `#/google-exchange`:

```js
router.on('#/google-exchange', async function () {
  var params = new URLSearchParams(location.hash.split('?')[1] || '');
  var code = params.get('code');
  if (!code) { location.hash = '#/login?err=no_code'; return; }
  try {
    var res = await fetch(HM.config.apiBase + '/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ code: code }),
    });
    if (!res.ok) throw new Error('exchange_failed');
    var data = await res.json();
    HM.auth.storeToken(data.token, data.user);   // existing helper
    history.replaceState(null, '', location.pathname);  // strip the code from URL
    location.hash = '#/';                                 // go to dashboard
  } catch (e) {
    location.hash = '#/login?err=exchange_failed';
  }
});
```

(Check existing portal router code to match its signature — the route definition above is illustrative; the real router call will use whatever pattern other routes in portal.js use.)

---

## Item 4 — Railway env vars (USER STEP)

After Item 1 produces your Client ID + Client Secret, add these to Railway **Shared Variables** so both the web service and the cron service inherit them:

```
GOOGLE_CLIENT_ID=<paste from Google Console>
GOOGLE_CLIENT_SECRET=<paste from Google Console>
GOOGLE_REDIRECT_URI=https://hansmed-system-production.up.railway.app/api/auth/google/callback
FRONTEND_URL=https://hansmedtcm.com
```

Make sure `GOOGLE_REDIRECT_URI` matches EXACTLY what you put in Google Console (trailing slash, http vs https, subdomain — all must match or you'll see `redirect_uri_mismatch`).

---

## Item 5 — Database migration (USER push or CC commit)

After Item 2c's migration file is created, push to master. Railway auto-deploys. To run the migration:

```bash
railway service hansmed-backend
railway ssh "php artisan migrate --force"
```

The `--force` flag bypasses the production-confirmation prompt.

---

## Acceptance criteria

After Phase 15 ships, all of these should pass:

1. **Console + env vars** — `redirect_uri_mismatch` does NOT appear when clicking the button. The Google consent screen loads correctly.
2. **New user via Google** — sign in with a Gmail that's never registered → arrives at portal dashboard logged in. DB row in `users` has `google_id` set, `email_verified_at` set, `password` is a random hash (unusable for password login).
3. **Existing user account-link** — register a user with email/password, sign out, then click Continue with Google with that same Gmail → user logs in, DB row's `google_id` is now set, password is unchanged.
4. **Existing google user** — second login with same Gmail → no new DB row, just logs in.
5. **Cancel flow** — click Continue with Google, hit Cancel on Google's consent screen → land on `/v2/index.html?google_error=auth_failed`. Auth modal can re-open.
6. **Token never in URL bar** — after a successful login, `history.replaceState` has cleared `?code=...` from the URL.
7. **Exchange code expires** — wait 70 sec after callback, replay the same exchange POST → returns 400 `Code expired or invalid`.
8. **Exchange code single-use** — POST exchange with valid code → 200. Replay same code immediately → 400.

---

## Risks

- 🟢 **Low**: Standard OAuth pattern, well-trodden Laravel Socialite path, hundreds of thousands of similar implementations.
- 🟡 **Watch — `redirect_uri_mismatch`**: most common first-time error. Triple-check the URI matches between Google Console and Railway env var.
- 🟡 **Watch — domain not verified for branding**: Google may show a "verify your domain" warning during consent screen if app is in production mode and the domain isn't verified in Search Console. While in Testing mode, this is fine.
- 🟢 **CSRF**: stateless mode is the standard pattern for SPA + API backends. Google's authorization codes are one-time-use and bound to the redirect URI, mitigating most CSRF attacks.
- 🟢 **Token leakage via URL**: mitigated by exchange-code pattern — token never appears in the browser URL.

---

## Commit messages

For Item 2 (backend Socialite + controller):
```
feat(backend): Google OAuth login via Laravel Socialite (Brief #15)

- Add laravel/socialite dependency
- Migration: google_id (unique nullable) + avatar_url on users
- AuthGoogleController with redirect/callback/exchange endpoints
- Stateless OAuth (SPA cross-domain), one-time exchange code pattern
  for token return — token never appears in URL
- Auto-link existing accounts by email; auto-set email_verified_at
  since Google has already verified the address
```

For Item 3 (frontend button + exchange handler):
```
feat(landing+portal): Continue with Google button + exchange handler (Brief #15)

Adds Google sign-in button to auth modal (login + register tabs).
On click → backend OAuth redirect. Backend bounces user to portal
with a one-time exchange code; portal POSTs exchange, stores Sanctum
token, lands on dashboard.

Cache-bust: landing.js?v=15-google-oauth
```

---

## Out of scope for Phase 15

- Apple Sign-In (separate brief; lower volume than Google in Malaysia)
- Doctor accounts via Google OAuth (deferred to a doctor-onboarding brief)
- Avatar caching/CDN (we just store the Google avatar URL; if Google rotates it, the link breaks until next login)
- Username/handle decoupling (we use `name` from Google; users may want to edit it later — separate UX brief)

---

## Rollback per item

- **Item 1 (Console)**: delete the OAuth client credentials in Google Console. App stops working but no data harm.
- **Item 2 (backend)**: revert the commit. Existing google-linked users can no longer use Google login but their accounts remain — they can still log in with email if they happened to set a password (most won't have, since OAuth users get a random unusable password). Mitigation: don't roll back without a plan; instead, fix-forward.
- **Item 3 (frontend)**: revert the commit. Users see the old auth modal without the Google button.
- **Migration rollback** (`php artisan migrate:rollback --step=1`): drops `google_id` and `avatar_url` columns. Data loss for those columns.

---

## Suggested sequencing within Phase 15

1. **You** start Item 1 (Google Console) — 10 min
2. **CC** ships Item 2a–2g (backend) and 3a–3c (frontend) in parallel — 1 hr
3. Migration runs on Railway after backend is deployed — 1 min
4. **You** add env vars to Railway Shared Variables — 5 min
5. End-to-end smoke test — 10 min
6. Optional: publish OAuth consent screen so non-test-users can sign in — 5 min
