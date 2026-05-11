# Brief #3 — Home page herb shop CTA: "Coming Soon" when shop is disabled

## Background

On the home page (`v2/index.html`), the third service card in the "Our Services" section contains a "Browse herbs →" button (line 376). It calls `go('shop')` which navigates to `shop.html`. The admin "shop_enabled" toggle (System Settings) already controls hiding shop links across the rest of the public site via `v2/assets/js/public-feature-flags.js` — but for this specific button, we want different behavior:

- **shop_enabled === true (default):** button shows "Browse herbs →", clickable, navigates to shop.
- **shop_enabled === false:** button is replaced with a "Coming Soon · 即將推出" disabled-looking element. The service card itself stays visible (so home page still shows 3 services, not 2).

The herb shop service is part of the brand promise and should still be advertised; only the CTA changes.

## TASK A — Mark the home-page shop CTA so the flag script can target it specially

In `v2/index.html` around line 376, replace:

```html
<button class="btn-v4 btn-outline btn-sm" onclick="go('shop')">Browse herbs →</button>
```

with a wrapper that contains BOTH the live CTA and the coming-soon placeholder, with the placeholder hidden by default. The flag script flips visibility based on `shop_enabled`:

```html
<div class="home-shop-cta" data-home-shop-cta>
  <button class="btn-v4 btn-outline btn-sm home-shop-cta__live" onclick="go('shop')">
    <span lang="en">Browse herbs →</span>
    <span lang="zh">瀏覽藥材 →</span>
  </button>
  <span class="btn-v4 btn-outline btn-sm home-shop-cta__soon" hidden aria-disabled="true"
        style="opacity:0.55;cursor:not-allowed;pointer-events:none;">
    <span lang="en">Coming Soon</span>
    <span lang="zh">即將推出</span>
  </span>
</div>
```

The `data-home-shop-cta` attribute is the JS hook. Both children are styled identically as buttons; only one is visible at a time.

## TASK B — Update `public-feature-flags.js` to special-case this CTA

In `v2/assets/js/public-feature-flags.js`, the current `applyShopDisabled()` function hides anything matching `[onclick*="go('shop')"]`. That selector now matches our new `.home-shop-cta__live` button — which is what we want for it (hide the live button) — BUT we ALSO need to reveal the coming-soon placeholder sibling.

Add a new step to `applyShopDisabled()` after step 1:

```js
// Step 1b: For the home-page herb shop CTA, instead of leaving the
// service card with no button, swap in the "Coming Soon" placeholder.
// The live button has already been hidden by step 1's selector match.
document.querySelectorAll('[data-home-shop-cta]').forEach(function (wrap) {
  var soon = wrap.querySelector('.home-shop-cta__soon');
  if (soon) soon.hidden = false;
});
```

Also, when `shop_enabled === true` (the `else` branch around line 89 where `documentElement.classList.remove('shop-disabled')` runs), make sure the placeholder is hidden again — defensive in case a stale state somehow persisted:

```js
// Restore live CTA, hide coming-soon placeholder.
document.querySelectorAll('[data-home-shop-cta]').forEach(function (wrap) {
  var live = wrap.querySelector('.home-shop-cta__live');
  var soon = wrap.querySelector('.home-shop-cta__soon');
  if (live) live.style.display = '';
  if (soon) soon.hidden = true;
});
```

## TASK C — Pre-paint flash prevention

`public-feature-flags.js` already persists `hm-shop-enabled` to localStorage. Most pages have a small inline `<script>` in the `<head>` that reads this localStorage value and adds `shop-disabled` to `<html>` BEFORE paint, so the user never sees a "Browse herbs →" flash on page load when shop is disabled.

Verify `index.html` already has this inline pre-paint script (search for `hm-shop-enabled` or `shop-disabled` in the head). If yes, add a CSS rule that uses the class to swap the CTA pre-paint:

```css
.shop-disabled .home-shop-cta__live { display: none !important; }
.shop-disabled .home-shop-cta__soon { display: inline-flex !important; }
```

If `index.html` does NOT have the pre-paint script, add one to its `<head>`:

```html
<script>
  try {
    if (localStorage.getItem('hm-shop-enabled') === '0') {
      document.documentElement.classList.add('shop-disabled');
    }
  } catch (_) {}
</script>
```

The CSS rule above can live in `v2/assets/css/components.css` or in an inline `<style>` block on `index.html` — wherever the existing `.shop-disabled` styling lives.

## ACCEPTANCE CRITERIA

- In admin System Settings, toggle shop OFF → reload `hansmedtcm.github.io` home page → service card still shows the herb shop content (icon, headline, description) but the CTA reads "Coming Soon · 即將推出" in a muted/disabled style. No clickable navigation.
- Toggle shop ON → reload home page → CTA reads "Browse herbs →" again, fully clickable, navigates to shop.
- No flash of "Browse herbs →" when shop is disabled (pre-paint script + CSS handles it).
- All existing shop-link hiding behavior (nav, About dropdown, mobile drawer, footer, shop.html redirect) still works. No regression on those.
- Works in both EN and ZH language modes (the `<span lang="...">` switching honors the page's language toggle).

## REPORT BACK

```
Files changed: [paths + line numbers]
Pushed to: [commit hash]
Tested with shop OFF: [Coming Soon visible, no flash, card otherwise intact]
Tested with shop ON: [Browse herbs visible, clickable]
Existing shop-hide behavior preserved: [nav, dropdown, footer, mobile drawer, shop.html redirect — confirmed working]
Pre-paint flash prevention in place: [yes/no — describe how verified]
```
