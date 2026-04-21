# Simulated Payment Banner — Copy & Placement Spec

**Version:** 1.0
**Date:** 2026-04-21
**Status:** Required before pilot launch (blocks public release)

## Why this exists

Per compliance report, payment integration is not wired to a live processor. Displaying any checkout UI without this banner risks:
- Misleading users that real charges occur (consumer protection issue under Malaysian Consumer Protection Act 1999)
- BNM inquiry if end-to-end payment appears operational without e-money license
- Claude Usage Policy: avoiding deception in user-facing software

## Visual Spec

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  SIMULATED PAYMENT — NO REAL CHARGES WILL BE MADE   │
│ This is a pilot build for testing only.                 │
└─────────────────────────────────────────────────────────┘
```

- **Background:** `#FFF4CC` (amber-50)
- **Border:** `2px solid #D97706` (amber-600)
- **Text:** `#78350F` (amber-900), bold for line 1, regular for line 2
- **Padding:** `12px 16px`
- **Font size:** 15px (line 1), 13px (line 2)
- **Position:** Sticky at top of checkout/POS pages, above any price or CTA
- **Must not be dismissible** during pilot phase
- **Print-visible:** Include in all receipt PDFs and order confirmation emails

## Copy — Three Languages

### English (default)

**Line 1 (bold):** SIMULATED PAYMENT — NO REAL CHARGES WILL BE MADE
**Line 2:** This is a pilot build for testing only. No money will be deducted and no goods will be dispatched commercially.

### Bahasa Malaysia

**Line 1 (bold):** PEMBAYARAN SIMULASI — TIADA CAJ SEBENAR DIKENAKAN
**Line 2:** Ini adalah versi perintis untuk ujian sahaja. Tiada wang akan dipotong dan tiada barangan akan dihantar secara komersial.

### 中文 (简体)

**Line 1 (bold):** 模拟付款 — 不会收取任何实际费用
**Line 2:** 这是仅用于测试的试点版本。不会扣除任何款项，也不会进行商业发货。

## Placements (exhaustive)

| Location | Required? |
|---|---|
| Patient checkout page (`/patient/checkout`) | YES — top, sticky |
| Pharmacy POS page | YES — top, sticky |
| Order confirmation page | YES — below order total |
| Order confirmation email | YES — first paragraph |
| Receipt PDF | YES — header watermark + footer line |
| Admin order list | NO (internal) |
| Doctor portal | N/A (no payment UI) |

## Removal Criteria

Banner is removed when ALL of these are true:
1. Live Stripe (or chosen PSP) webhook tested with `livemode: true` payload
2. BNM e-money license obtained OR agreement with PSP that covers regulatory umbrella
3. Refund flow tested end-to-end
4. Terms of Service updated to reflect real commerce
5. Finance ledger reconciliation confirmed against PSP dashboard

Until ALL five pass, banner stays. No exceptions.

## Acceptance Criteria for Coder

- [ ] Banner component in `v2/js/components/SimulatedPaymentBanner.js` (or equivalent)
- [ ] Rendered on every page listed above
- [ ] Language switcher updates banner text
- [ ] Banner present in receipt PDF generation
- [ ] Banner present in order confirmation email template
- [ ] Visual regression test: screenshot checkout page, banner must be visible in top 200px
