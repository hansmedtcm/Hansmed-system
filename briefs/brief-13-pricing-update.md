# Brief #13 — Pricing finalization + remove in-person mentions (v3/services.html only)

**Classification: CONTENT — scope: replace 5+ [PRICE: TBD] placeholders in v3/services.html with confirmed pricing. Also remove "in-person" service mentions across the page since HansMed has no physical clinic yet — video-only at launch. v2 untouched.**

## Background

Brief #12 (v3 cutover) is complete. v3 is live; analytics are flowing. Next priority is filling the 5 [PRICE: TBD] placeholders on `v3/services.html` with the prices CEO has decided.

While we're in there, we also need to fix a credibility risk: the page currently advertises **in-person consultations**, but HansMed has no physical clinic yet — services are video-only. Promising in-person and not delivering = trust problem with patients and the BIG Caring / HeyDoc partner referrals.

## Confirmed pricing decisions (CEO, 2026-05-04)

| Service | Decision | Display |
|---|---|---|
| Video consult — random practitioner | **RM 35** | "From RM 35 · launch promo" |
| Video consult — chosen practitioner | **RM 55** | "RM 55 · choose your practitioner" |
| Follow-up consult | Same as initial (RM 35 / RM 55) | "Follow-ups same price" |
| In-person consult | Not yet available | Remove from active copy; mark "Coming soon" if mentioned at all |
| Herb shop OTC | Variable per prescription | "Prices vary by prescription · Speak to your practitioner" |
| Delivery fees | Calculated at checkout | Don't list specific numbers |
| AI Wellness | Free during beta | "Free during beta" |

**Strategic framing:** Use "launch promo" wording on consultation prices so we can raise them later without breaking trust. Don't promise a specific end date for the promo.

## TASK A — Update the comparison table (lines ~241-245)

Find this block:

```html
<tr>
  <th><span lang="en">Pricing</span><span lang="zh">收費</span></th>
  <td><span lang="en">Free (currently)</span><span lang="zh">免費（目前）</span></td>
  <td><span lang="en">[PRICE: TBD] / session</span><span lang="zh">[PRICE: TBD] / 次</span></td>
  <td><span lang="en">From [PRICE: TBD]</span><span lang="zh">[PRICE: TBD] 起</span></td>
</tr>
```

Replace with:

```html
<tr>
  <th><span lang="en">Pricing</span><span lang="zh">收費</span></th>
  <td><span lang="en">Free during beta</span><span lang="zh">公測期免費</span></td>
  <td><span lang="en">From RM 35 / session</span><span lang="zh">RM 35 起 / 次</span></td>
  <td><span lang="en">By prescription</span><span lang="zh">依處方計價</span></td>
</tr>
```

## TASK B — Update the comparison table "Practitioner involvement" row (lines ~228-233)

The current copy says "Direct video or in-person session with the practitioner". Since we're video-only:

Find:
```html
<td><span lang="en">Direct video or in-person session with the practitioner</span><span lang="zh">與中醫師視訊或親診</span></td>
```

Replace with:
```html
<td><span lang="en">Direct video session with the practitioner</span><span lang="zh">與中醫師視訊問診</span></td>
```

## TASK C — Update AI Wellness pricing line (lines ~299-306)

Find:

```html
<h3 class="pricing-h">
  <span lang="en">Pricing</span>
  <span lang="zh">收費</span>
</h3>
<p class="pricing-line">
  <span lang="en">Free during early access. <span class="pricing-note">Future pricing: [PRICE: TBD] per assessment after [DATE: TBD].</span></span>
  <span lang="zh">早期使用期免費。<span class="pricing-note">未來收費：[PRICE: TBD] / 次（於 [DATE: TBD] 後生效）。</span></span>
</p>
```

Replace with:

```html
<h3 class="pricing-h">
  <span lang="en">Pricing</span>
  <span lang="zh">收費</span>
</h3>
<p class="pricing-line">
  <span lang="en"><strong>Free during beta.</strong> <span class="pricing-note">We'll announce pricing well in advance before any change.</span></span>
  <span lang="zh"><strong>公測期免費。</strong><span class="pricing-note">如有收費調整，我們會提前公告。</span></span>
</p>
```

## TASK D — Update TCM Consultations section (multiple changes)

### D1 — Update the lead paragraph (lines ~360-363)

Find:
```html
<p class="service-lead">
  <span lang="en">Video or in-person consultations with licensed TCM practitioners. Pulse, tongue, voice, observation — the four classical methods, applied to your concern. The practitioner can issue herbal prescriptions if needed, dispensed by our partner pharmacy.</span>
  <span lang="zh">視訊或親診中醫問診。望聞問切四診合參，由持牌中醫師依您的情況進行。如需要，醫師可開立中藥處方，由合作藥房調配。</span>
</p>
```

Replace with:
```html
<p class="service-lead">
  <span lang="en">Video consultations with licensed TCM practitioners. Tongue, voice, observation, and detailed history-taking — applied to your concern. The practitioner can issue herbal prescriptions if needed, dispensed by our partner pharmacy. <em>In-person consultations coming soon.</em></span>
  <span lang="zh">與持牌中醫師視訊問診。望聞問與詳細問診 —— 依您的情況進行。如需要，醫師可開立中藥處方，由合作藥房調配。<em>親診服務即將推出。</em></span>
</p>
```

### D2 — Update "How it works" step 1 (lines ~370-373)

Find:
```html
<li>
  <span lang="en">Book a slot in your portal — choose video or in-person, your preferred language, and (optionally) a specific practitioner.</span>
  <span lang="zh">於入口預約時段 —— 選擇視訊或親診、偏好語言，亦可指定中醫師。</span>
</li>
```

Replace with:
```html
<li>
  <span lang="en">Book a slot in your portal — choose your preferred language, and (optionally) a specific practitioner.</span>
  <span lang="zh">於入口預約時段 —— 選擇偏好語言，亦可指定中醫師。</span>
</li>
```

### D3 — Update "How it works" step 2 (lines ~374-377)

Find:
```html
<li>
  <span lang="en">Arrive on time: video patients click the link in their portal; in-person patients come to the partner clinic at the appointed slot.</span>
  <span lang="zh">準時到診：視訊患者點擊入口的連結；親診患者依約到合作診所。</span>
</li>
```

Replace with:
```html
<li>
  <span lang="en">Arrive on time: click the consultation link in your portal at the appointed slot.</span>
  <span lang="zh">準時上線：依約點擊入口的問診連結。</span>
</li>
```

### D4 — Update the pricing line (lines ~388-395)

Find:
```html
<h3 class="pricing-h">
  <span lang="en">Pricing</span>
  <span lang="zh">收費</span>
</h3>
<p class="pricing-line">
  <span lang="en">Video consultation: [PRICE: TBD] per session. In-person: [PRICE: TBD] per session. Follow-up consultations: [PRICE: TBD].</span>
  <span lang="zh">視訊問診：[PRICE: TBD] / 次。親診：[PRICE: TBD] / 次。複診：[PRICE: TBD]。</span>
</p>
```

Replace with:
```html
<h3 class="pricing-h">
  <span lang="en">Pricing</span>
  <span lang="zh">收費</span>
</h3>
<p class="pricing-line">
  <span lang="en"><strong>RM 35</strong> per video consultation (random practitioner) — <em>launch promo</em>. <strong>RM 55</strong> if you want to choose a specific practitioner. Follow-up consultations are the same price as the initial visit. <span class="pricing-note">In-person consultations coming soon — pricing TBA.</span></span>
  <span lang="zh"><strong>RM 35</strong> / 次（系統隨機分配中醫師）—— <em>公測期優惠</em>。<strong>RM 55</strong> / 次（指定中醫師）。複診收費與初診相同。<span class="pricing-note">親診服務即將推出，收費另行公告。</span></span>
</p>
```

### D5 — Update the in-person FAQ (lines ~403-406)

The current FAQ "What's the difference between video and in-person?" is now misleading because in-person isn't available. Replace the whole `<div class="faq-item">` block with one about video quality.

Find:
```html
<div class="faq-item">
  <h4><span lang="en">What's the difference between video and in-person?</span><span lang="zh">視訊與親診有何不同？</span></h4>
  <p><span lang="en">Both work for follow-ups. For first visits, in-person is preferred when feasible because the practitioner can take your pulse directly — pulse diagnosis (脈診) is one of the four classical TCM methods and cannot be done over video. For ongoing care or busy schedules, video works well; the practitioner adjusts based on what they can observe.</span><span lang="zh">複診兩者皆可。初診若情況允許，建議親診 —— 醫師可親自把脈。脈診為望聞問切四診之一，無法透過視訊進行。對於持續調理或忙碌行程，視訊問診亦可，醫師會依可觀察到的徵象調整。</span></p>
</div>
```

Replace with:
```html
<div class="faq-item">
  <h4><span lang="en">Will I see in-person consultations later?</span><span lang="zh">未來會有親診服務嗎？</span></h4>
  <p><span lang="en">Yes — in-person consultations are on our near-term roadmap. We're starting video-only at launch so every patient gets the same quality experience regardless of where they live in Malaysia. When in-person opens, we'll announce locations, pricing, and booking flow ahead of time. For pulse diagnosis (脈診) — one of the four classical TCM methods that needs in-person assessment — your practitioner will note when an in-person visit would meaningfully add to your care.</span><span lang="zh">會的 —— 親診服務在我們的短期計劃中。公測期先採視訊問診，確保馬來西亞各地患者皆獲一致的服務品質。親診開放時，我們會提前公告地點、收費與預約流程。脈診（望聞問切四診之一）需親診進行；如您的情況確實需要，醫師會適時建議。</span></p>
</div>
```

## TASK E — Update Herb Shop pricing line (lines ~471-478)

Find:
```html
<h3 class="pricing-h">
  <span lang="en">Pricing</span>
  <span lang="zh">收費</span>
</h3>
<p class="pricing-line">
  <span lang="en">Prescription orders priced per ingredient — total shown at checkout. OTC supplements from [PRICE: TBD]. Delivery: [PRICE: TBD] (Klang Valley), [PRICE: TBD] (rest of Peninsular Malaysia); free over [PRICE: TBD].</span>
  <span lang="zh">處方藥按單味計價，結帳時顯示總額。非處方補充品從 [PRICE: TBD] 起。配送費：[PRICE: TBD]（巴生谷）、[PRICE: TBD]（西馬其他地區）；滿 [PRICE: TBD] 免運費。</span>
</p>
```

Replace with:
```html
<h3 class="pricing-h">
  <span lang="en">Pricing</span>
  <span lang="zh">收費</span>
</h3>
<p class="pricing-line">
  <span lang="en">Prescription orders are priced per ingredient — total shown at checkout. <strong>Prices vary by prescription</strong>; speak to your practitioner during your consultation for an estimate before ordering. <span class="pricing-note">OTC catalogue and delivery fees calculated at checkout.</span></span>
  <span lang="zh">處方藥按單味計價，結帳時顯示總額。<strong>收費依處方而定</strong>；如需了解大致費用，可於問診時與中醫師討論。<span class="pricing-note">非處方目錄與配送費於結帳時計算。</span></p>
```

## TASK F — Update <meta description> to remove in-person mention (line 22 + OG/Twitter tags)

Currently the meta description says "video and in-person TCM consultations". Since we're video-only at launch:

### F1 — Update line 22 (`<meta name="description">`)

Find:
```html
<meta name="description" content="HansMed services — AI tongue analysis, video and in-person TCM consultations with licensed practitioners, prescription-linked herb shop. Pricing, FAQ, and how each works.">
```

Replace with:
```html
<meta name="description" content="HansMed services — AI tongue analysis, video TCM consultations with licensed practitioners (RM 35 launch promo), prescription-linked herb shop. Pricing, FAQ, and how each works.">
```

### F2 — Update OG description (line 30)

Find:
```html
<meta property="og:description" content="HansMed services — AI tongue analysis, video and in-person TCM consultations with licensed practitioners, prescription-linked herb shop. Pricing, FAQ, and how each works.">
```

Replace with:
```html
<meta property="og:description" content="HansMed services — AI tongue analysis, video TCM consultations with licensed practitioners (RM 35 launch promo), prescription-linked herb shop. Pricing, FAQ, and how each works.">
```

### F3 — Update Twitter description (line 39)

Find:
```html
<meta name="twitter:description" content="HansMed services — AI tongue analysis, video and in-person TCM consultations with licensed practitioners, prescription-linked herb shop. Pricing, FAQ, and how each works.">
```

Replace with:
```html
<meta name="twitter:description" content="HansMed services — AI tongue analysis, video TCM consultations with licensed practitioners (RM 35 launch promo), prescription-linked herb shop. Pricing, FAQ, and how each works.">
```

## TASK G — Verify no other [PRICE: TBD] or in-person mentions remain

After all edits, run:
```bash
grep -n "PRICE: TBD" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -n "DATE: TBD" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -in "in-person" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -in "親診" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
```

The first two should return **zero results**. The last two are allowed to return matches **only inside the "Coming soon" framing** (Tasks D1 and D5). Anything else needs to be reworded.

Also verify other v3 pages don't contain in-person promises that contradict this change:
```bash
grep -in "in-person" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/index.html
grep -in "in-person" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/about.html
grep -in "in-person" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
grep -in "親診" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/index.html
grep -in "親診" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/about.html
grep -in "親診" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
```

If matches are found, **flag them in the report** but DO NOT modify other v3 pages without checking with CEO first — they may have nuanced framing that needs human review.

## ACCEPTANCE CRITERIA

- All 5 [PRICE: TBD] markers and [DATE: TBD] marker in `v3/services.html` are gone (confirmed via grep returning zero results).
- Comparison table shows: Free during beta · From RM 35 / session · By prescription.
- TCM Consultation lead text says "Video consultations" not "Video or in-person".
- TCM Consultation pricing line shows RM 35 (random) / RM 55 (chosen), framed as "launch promo", with same-price-for-follow-ups.
- TCM Consultation FAQ no longer asks "What's the difference between video and in-person?" — replaced with "Will I see in-person consultations later?" reassurance.
- Herb Shop pricing line says "Prices vary by prescription · speak to your practitioner" with no specific delivery numbers.
- AI Wellness pricing line says "Free during beta" — no future pricing placeholder.
- `<meta name="description">`, OG description, and Twitter description all updated to remove "in-person" and add "RM 35 launch promo".
- v2 untouched — no v2 file modified.
- Only `v3/services.html` modified in this brief (other v3 pages flagged for CEO review if they contain in-person mentions, but NOT changed in this brief).
- Bilingual EN/ZH parity preserved everywhere.
- All HTML structure (class names, span tags, lang attributes) preserved exactly — no broken markup.

## REPORT BACK

```
File modified: v3/services.html
Pushed to: [commit hash]

[PRICE: TBD] count after edit: [should be 0]
[DATE: TBD] count after edit: [should be 0]
"in-person" remaining mentions in services.html: [list with line numbers; should only be the "Coming soon" framing]

Other v3 pages with in-person mentions found (NOT modified):
- v3/index.html: [line numbers if any]
- v3/about.html: [line numbers if any]
- v3/practitioners.html: [line numbers if any]

Bilingual parity check passed: [yes/no]
HTML structure preserved (no broken tags, classes, or lang spans): [yes/no]

Anything you noticed that needs CEO attention: [list]
```

If during implementation you find HTML structure that doesn't match the line numbers in this brief (file may have shifted), use the EXACT old_string content to locate the block — don't rely on line numbers alone. The exact text snippets in this brief are the source of truth.

If any [PRICE: TBD] or [DATE: TBD] marker doesn't match what's described above (i.e., the file was edited between when this brief was written and when you're executing it), STOP and report — don't guess what the price should be.
