# Brief #3b — Apply shop-CTA Coming Soon to services.html

## Background

Brief #3 fixed the home page (`index.html`) but the user was actually testing on `services.html`, which has its own shop-related CTAs that weren't covered. Two buttons on services.html still show "Browse herbs"/"Browse Shop" when the admin has toggled shop off:

1. **Line 939** — Herb shop service card: `<button class="btn btn-outline btn-sm" onclick="go('services')">Browse herbs →</button>`. Note the `onclick="go('services')"` is a typo — should be `go('shop')`.
2. **Line 1028** — Larger CTA below: `<button class="btn btn-wd" onclick="go('register')">Browse Shop · 瀏覽商店</button>`. Also mismatched — should be `go('shop')`.

services.html already has the pre-paint script (line 6) and includes `public-feature-flags.js` (line 1621), so the infrastructure is in place. We just need wrappers.

## TASK A — Wrap both buttons + fix the broken onclicks

### Button 1 (line 939, herb shop service card)

Replace:

```html
<button class="btn btn-outline btn-sm" onclick="go('services')">Browse herbs →</button>
```

with:

```html
<div class="home-shop-cta" data-home-shop-cta>
  <button class="btn btn-outline btn-sm home-shop-cta__live" onclick="go('shop')">
    <span lang="en">Browse herbs →</span>
    <span lang="zh">瀏覽藥材 →</span>
  </button>
  <span class="btn btn-outline btn-sm home-shop-cta__soon" hidden aria-disabled="true"
        style="opacity:0.55;cursor:not-allowed;pointer-events:none;">
    <span lang="en">Coming Soon</span>
    <span lang="zh">即將推出</span>
  </span>
</div>
```

(Reuses the same `data-home-shop-cta` attribute as index.html so `public-feature-flags.js` already handles it without changes. Also fixes the `go('services')` → `go('shop')` typo.)

### Button 2 (line 1028, larger Browse Shop CTA)

Replace:

```html
<button class="btn btn-wd" onclick="go('register')">Browse Shop · 瀏覽商店</button>
```

with:

```html
<div class="home-shop-cta" data-home-shop-cta>
  <button class="btn btn-wd home-shop-cta__live" onclick="go('shop')">
    <span lang="en">Browse Shop</span>
    <span lang="zh">瀏覽商店</span>
  </button>
  <span class="btn btn-wd home-shop-cta__soon" hidden aria-disabled="true"
        style="opacity:0.55;cursor:not-allowed;pointer-events:none;">
    <span lang="en">Coming Soon</span>
    <span lang="zh">即將推出</span>
  </span>
</div>
```

(Also fixes the `go('register')` → `go('shop')` mismatch. The CTA's text said Browse Shop but routed to register, which was wrong.)

## TASK B — Add the CSS rules so the swap works pre-paint

The CSS rules live inline in `index.html`'s `<style>` block. They need to also live on `services.html`. Two options:

- **Option B1 (preferred):** Move the rules to a shared CSS file so every page that links it gets the swap behavior automatically. Add this to the END of `v2/assets/css/components.css`:

```css
/* Two-state shop CTA — paired with [data-home-shop-cta] wrapper.
   .shop-disabled is set on <html> by the per-page pre-paint inline
   script when localStorage hm-shop-enabled === '0', and is also
   applied at runtime by public-feature-flags.js after the live
   /public/features fetch. */
.home-shop-cta__live { display: inline-flex; }
.home-shop-cta__soon { display: none; }
.shop-disabled .home-shop-cta__live { display: none !important; }
.shop-disabled .home-shop-cta__soon { display: inline-flex !important; }
```

Then REMOVE the same block from `v2/index.html` (around lines 25-28 inside the head `<style>`) since it's now in components.css. services.html and index.html both link components.css, so both pages pick up the rules.

- *Option B2:* duplicate the inline `<style>` block from index.html into services.html. Simpler change but creates duplicate CSS that drifts. Avoid.

Use Option B1.

## TASK C — Verify the JS still works

`public-feature-flags.js` already targets `[data-home-shop-cta]` wrappers in step 1b — no change needed there. Just confirm by inspection that the existing logic handles multiple wrappers on the same page (forEach loop, so yes).

## ACCEPTANCE CRITERIA

- Toggle shop OFF in admin → reload `hansmedtcm.github.io/Hansmed-system/v2/services.html` → both buttons (the small one in the herb card AND the larger one in the bottom Quality Herb Shop section) read "Coming Soon · 即將推出" in muted/disabled style. Both unclickable.
- Toggle shop ON → reload → both buttons read their respective live labels and click through to `shop.html` (not register or services anymore).
- index.html still works the same way (its CTA still goes to Coming Soon when off, Browse herbs when on).
- No flash of "Browse Shop" on services.html load when shop is disabled (pre-paint handles it).
- Both EN/ZH language modes render the correct text.

## REPORT BACK

```
Files changed: [paths + line numbers]
Pushed to: [commit hash]
Tested with shop OFF on services.html: [Coming Soon visible on both buttons]
Tested with shop ON on services.html: [Browse herbs + Browse Shop visible, click to shop.html]
Verified index.html still works: [yes]
CSS moved to components.css and removed from index.html inline style: [yes]
```
