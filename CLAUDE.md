# HansMed Design System — Handoff for Claude Code

This document is the source of truth for **how to add new modules to the HansMed v2 site without re-fragmenting the design**. Read it before touching markup or CSS.

---

## TL;DR

Every page imports two stylesheets, in this order:

```html
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/components.css">
```

Then write **plain HTML** that uses canonical classes (`.btn .btn--primary`, `.card`, `.alert alert--success`, `.field .input`). Do NOT introduce page-local component CSS unless it can't be expressed by the system — and if you do, add it to `components.css`, not the page.

The showcase at `design-system/showcase.html` is the live reference. If you can't find a class for what you need there, propose adding one.

---

## File map

```
design-system/
├── tokens.css          ← copied from assets/css/tokens.css (single source)
├── components.css      ← canonical components — copy back to assets/css/
├── showcase.html       ← live reference, every component family
├── design-canvas.jsx   ← canvas shell (showcase only)
└── tweaks-panel.jsx    ← tweaks shell (showcase only)
```

`tokens.css` is the **same file** that lives at `assets/css/tokens.css`. Do not duplicate the values — when colors / type / spacing need to change, edit tokens.css and every page picks it up.

`components.css` is **new and ready to ship**. To deploy: copy `design-system/components.css` to `assets/css/components.css` (or merge with the existing one), and add the `<link>` to every page.

---

## Naming convention

Canonical naming is **BEM** (`.block`, `.block__element`, `.block--modifier`). The auth/dashboard surfaces already use this. The homepage uses a parallel `-v4` suffix family — those are kept working via aliases in `components.css`, but **all new code should use the canonical names**.

| Use this | Not this |
|---|---|
| `.btn .btn--primary` | `.btn-v4 .btn-dark` |
| `.btn .btn--outline` | `.btn-v4 .btn-outline` |
| `.card` | `.card-v4` |
| `.site-header` / `.nav__link` | `#nav-v4 .nl` |
| `.hero .hero--editorial` | `.hero-v4 .hero-v3` |
| `.alert .alert--danger` | inline-style red box |
| `.pill .pill--active` | inline-style status text |

When migrating an existing v4 page, the visual result must be **identical** — the aliases enforce that. Diff the rendered page before and after.

---

## Component vocabulary

The full set lives in `components.css`. Core blocks:

- **Layout:** `.container`, `.section` + `.section--cream | --washi | --ink`, `.eyebrow`
- **Buttons:** `.btn` + `--primary | --accent | --outline | --outline-cream | --ghost | --danger | --success | --whatsapp`. Sizes: `--sm | --lg | --block`
- **Forms:** `.field`, `.field__label`, `.field__hint`, `.field__error`, `.input`, `.select`, `.textarea`, `.checkbox`, `.radio`. Error: add `--error` modifier to input.
- **Cards:** `.card` + `--white | --washi | --ink | --bordered | --clickable`. Slots: `.card__media`, `.card__eyebrow`, `.card__title`, `.card__zh`, `.card__body`, `.card__footer`. Specialised: `.card--practitioner`, `.card--testimonial`, `.card--blog`.
- **Tables:** `.table` + `--rounded | --striped | --compact`
- **Status:** `.alert` + `--info | --success | --warning | --danger`. `.pill` + `--pending | --active | --progress | --success | --danger | --neutral`.
- **Overlays:** `.toast` + `--success | --danger | --info` inside `.toast-stack`. `.modal-backdrop > .modal` with `__header / __title / __close / __body / __footer`.
- **States:** `.empty-state`, `.skeleton` + `--text | --title | --block`.
- **Chrome:** `.site-header`, `.brand`, `.nav`, `.nav__link`, `.lang-toggle`, `.site-footer`.
- **Hero:** `.hero` + `.hero--editorial | .hero--split`. Slots: `.hero__inner`, `.hero__eyebrow`, `.hero__title`, `.hero__sub`, `.hero__ctas`, `.hero__media`.
- **Page shells:** `.page-shell`, `.article-layout` + `.article-layout__aside`, `.dashboard-shell` + `__aside | __main`.

---

## Hard rules — never break

1. **No raw hex.** Reference `var(--token)`. The only exception is third-party brand colors (Google blue, WhatsApp green) inside their dedicated component class.
2. **Body type is 19.5px minimum.** `--text-base` is the floor; `--text-sm` is for meta only.
3. **Body weight ≥ 400.** No 300-weight body text — it fades on cream.
4. **Spacing is the geometric scale only.** `--s-1` (4) through `--s-20` (128). No `15px`, `22px`, `padding: 0.7rem` etc.
5. **Radius caps at `--r-2xl` (18px).** Pill is the only exception (buttons stay at `--r-md`).
6. **Bilingual rule.** Never glue EN and ZH inline in the same paragraph or button label except in the masthead. Use `<span lang="en">…</span><span lang="zh">…</span>` and let the language toggle hide the inactive one.
7. **Simplified Chinese only.** `汉方现代中医`, `预约`, `中医师`, `体质评估` — never the traditional equivalents.
8. **Compliance marks are typographic.** "KKM Registered", "T&CM Act 2016", "PDPA Compliant" rendered as text + hairline border, not as the actual agency logos.
9. **No "Coming Soon" badges in production.** Either ship or hide.
10. **AI copy must always say "AI-assisted, doctor-decided."** Never imply the AI diagnoses anything.

---

## Adding a new module — checklist

1. Sketch the page out of **existing classes only**. If you reach for an inline style for layout, you've drifted — go back to the system.
2. If a genuinely new component is needed (e.g. timeline, calendar widget), add the rules to `components.css` under a new BEM block. Reference tokens, not raw values.
3. Wire copy in both languages from day one. EN paragraph + `lang="zh"` paragraph, controlled by the language toggle.
4. Confirm contrast on cream: ink-on-cream is AAA, gold-on-cream is AA. If you need text on a gold tint, use `var(--gold-deep)`.
5. View the page next to `design-system/showcase.html` — they should feel like the same product.

---

## Two hero variations — when to use which

- **`.hero--editorial`** — centered, type-led. Use for the homepage and any landing where the hero IS the message. No image needed.
- **`.hero--split`** — image left/right of type, with stat/proof strip below. Use for product pages (Wellness Assessment, Practitioners) where a visual anchor helps comprehension.

Both variations are visible in `showcase.html` under the "Hero variations" section.

---

## Tweaks panel (showcase only)

The showcase ships with a tweaks panel exposing: primary color, accent, display font, body font, heading weight, density, radius, nav style. It's there so you can A/B values **without committing**. If a tweak feels right, hard-set it in `tokens.css` so it propagates everywhere.
