# Brief #14a-fix-3 — Constitution card: add REDUCE category for "(less)" foods

**Classification: BUGFIX + UX — scope: detect food items prefixed with `(less)`, `(reduce)`, `(limit)`, `(avoid)`, `(no)` and render them in a NEW third section called "REDUCE · 少量" between RECOMMENDED FOODS and AVOID. Fixes the misleading display where "(less) ice cream" currently appears as a recommended food.**

## Background

CEO screenshot 2026-05-04 surfaced a critical content issue:

The doctor's view of a Balanced Constitution patient shows these RECOMMENDED FOODS chips:
- Balanced diet ✅
- Seasonal vegetables & fruit ✅
- Polished rice & glutinous rice (粳米、糯米) ✅
- **(less) Iced drinks ❌ — should be REDUCE, not RECOMMENDED**
- **ice cream ❌ — should be REDUCE, not RECOMMENDED**
- **cold raw foods ❌ — should be REDUCE, not RECOMMENDED**

A patient (or doctor) seeing "Recommended foods: ice cream" could misinterpret as "eat ice cream is good for you" — opposite of clinical intent. The `(less)` prefix in the data is a hint that these items should be MODERATED, not consumed freely.

**Root cause:** historical `doctor_advice.foods` arrays (saved with old patient records) contain items literally prefixed with `(less)` because an earlier AI prompt or manual entry put "consume less of X" items in the foods array instead of avoid array. The renderer faithfully shows what's in the array.

**Fix approach:** rather than try to clean historical data (impossible without backend migration), enhance the renderer to detect these prefixed items at render time and route them to a new "REDUCE" section. Information preserved, displayed correctly.

**Coordination notes:**
- Day 2 tongue AI upgrade should fix the prompt so NEW doctor_advice entries put "(less)" items in `avoid` directly. This brief handles the historical/legacy data gracefully forever.
- Patient view (`ai-diagnosis.js`) and doctor view (`patients.js`) both use `HM.constitutionCard.renderAdvice()` after Brief #14a — so this fix benefits both views automatically.

## TASK A — Pre-flight snapshot

```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-14a-fix-3-pre-migration
mkdir -p $SNAP
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js $SNAP/constitution-card.js
```

Create `$SNAP/README.md` with rollback note.

## TASK B — Add detection helper for "(less)" prefix items

In `v2/assets/js/components/constitution-card.js`, add this helper function near `splitBilingual`:

```js
/**
 * Detect if a food/herb item starts with a "consume less of" prefix
 * like "(less)", "(reduce)", "(limit)", "(avoid)", "(no)".
 *
 * Returns { isReduce: bool, cleaned: string } where cleaned has the
 * prefix stripped so it can be displayed properly.
 *
 * Handles both string format ("(less) Iced drinks") and {en, zh}
 * object format ({en: "(less) Iced drinks", zh: "(少) 冰飲"}).
 *
 * Detection is case-insensitive and tolerates trailing space:
 *   "(less) ice cream"      → isReduce=true,  cleaned="ice cream"
 *   "(LESS) ice cream"      → isReduce=true,  cleaned="ice cream"
 *   "(reduce) cold drinks"  → isReduce=true,  cleaned="cold drinks"
 *   "Balanced diet"         → isReduce=false, cleaned="Balanced diet"
 *   "(粳米、糯米)"          → isReduce=false (Chinese parens, not negative qualifier)
 */
function detectReducePrefix(item) {
  // Negative qualifiers — case-insensitive
  var REDUCE_PATTERNS = /^\s*\(\s*(less|reduce|limit|avoid|no|skip|moderate|少|減|忌|避|限)\s*\)\s*/i;

  function process(str) {
    var s = String(str || '');
    var match = s.match(REDUCE_PATTERNS);
    if (match) {
      return { isReduce: true, cleaned: s.slice(match[0].length).trim() };
    }
    return { isReduce: false, cleaned: s };
  }

  // Object format: check both en and zh; if either has the prefix, it's a reduce item
  if (item && typeof item === 'object' && (item.en || item.zh)) {
    var enResult = process(item.en);
    var zhResult = process(item.zh);
    var isReduce = enResult.isReduce || zhResult.isReduce;
    return {
      isReduce: isReduce,
      cleaned: isReduce
        ? { en: enResult.cleaned, zh: zhResult.cleaned }
        : item,
    };
  }

  // String format
  var result = process(item);
  return {
    isReduce: result.isReduce,
    cleaned: result.isReduce ? result.cleaned : item,
  };
}
```

Add it inside the IIFE near `bilingual()` and `splitBilingual()`.

## TASK C — Update renderAdvice() to split foods into recommended + reduce

Find the food-rendering block in `renderAdvice()` (the one updated by Brief #14a-fix-2). Replace it with:

```js
    // Split foods into REGULAR and REDUCE buckets
    var regularFoods = [];
    var reduceFoods = [];
    if (Array.isArray(adviceObj.foods)) {
      adviceObj.foods.forEach(function (f) {
        var detected = detectReducePrefix(f);
        if (detected.isReduce) {
          reduceFoods.push(detected.cleaned);
        } else {
          regularFoods.push(f);
        }
      });
    }

    // Render RECOMMENDED FOODS (regular items only)
    if (regularFoods.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Recommended foods', '建議食材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          regularFoods.map(function (f) {
            var parts = (f && typeof f === 'object' && (f.en || f.zh))
              ? { en: f.en || f.zh || '', zh: f.zh || f.en || '' }
              : splitBilingual(f);
            return '<span class="chip" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;">' +
              bilingual(parts.en, parts.zh) + '</span>';
          }).join('') +
        '</div></div>');
    }

    // Render REDUCE section (new — for "(less)" prefixed items)
    // Visual: amber-tinted chips with dashed border to signal "moderate, not avoid"
    if (reduceFoods.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Limit · 少量', 'Limit · 少量') +
        '<div class="text-xs" style="margin-bottom:6px;color:var(--muted);font-style:italic;">' +
          bilingual('Consume in smaller amounts', '建議減量食用') +
        '</div>' +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          reduceFoods.map(function (f) {
            var parts = (f && typeof f === 'object' && (f.en || f.zh))
              ? { en: f.en || f.zh || '', zh: f.zh || f.en || '' }
              : splitBilingual(f);
            return '<span class="chip chip-reduce" style="background:#FFF3CD;border:1px dashed #B5881A;border-radius:12px;padding:3px 10px;color:#6F5510;">' +
              bilingual(parts.en, parts.zh) + '</span>';
          }).join('') +
        '</div></div>');
    }
```

**Important:** the section heading uses bilingual labels — note `sectionHeading('Limit · 少量', 'Limit · 少量')` — same text both languages because "Limit · 少量" reads naturally in either mode (familiar to bilingual TCM patients in Malaysia).

## TASK D — Apply same logic to herbs (defensive — same pattern may exist)

The herbs array could theoretically contain `(less)` prefixed entries too (e.g., "(less) caffeinated tea"). Apply the same split logic:

Replace the existing herbs block with:

```js
    // Split herbs into REGULAR and REDUCE buckets
    var regularHerbs = [];
    var reduceHerbs = [];
    if (Array.isArray(adviceObj.herbs)) {
      adviceObj.herbs.forEach(function (h) {
        var detected = detectReducePrefix(h);
        if (detected.isReduce) {
          reduceHerbs.push(detected.cleaned);
        } else {
          regularHerbs.push(h);
        }
      });
    }

    // Render RECOMMENDED HERBS (regular items only)
    if (regularHerbs.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Recommended herbs', '建議藥材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          regularHerbs.map(function (h) {
            var parts = (h && typeof h === 'object' && (h.en || h.zh))
              ? { en: h.en || h.zh || '', zh: h.zh || h.en || '' }
              : splitBilingual(h);
            return '<span class="chip" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;">' +
              bilingual(parts.en, parts.zh) + '</span>';
          }).join('') +
        '</div></div>');
    }

    // Render REDUCE section for herbs (rare but defensively handled)
    if (reduceHerbs.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Use sparingly · 慎用', 'Use sparingly · 慎用') +
        '<div class="text-xs" style="margin-bottom:6px;color:var(--muted);font-style:italic;">' +
          bilingual('Use in smaller doses or under guidance', '建議少量或在指導下使用') +
        '</div>' +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          reduceHerbs.map(function (h) {
            var parts = (h && typeof h === 'object' && (h.en || h.zh))
              ? { en: h.en || h.zh || '', zh: h.zh || h.en || '' }
              : splitBilingual(h);
            return '<span class="chip chip-reduce" style="background:#FFF3CD;border:1px dashed #B5881A;border-radius:12px;padding:3px 10px;color:#6F5510;">' +
              bilingual(parts.en, parts.zh) + '</span>';
          }).join('') +
        '</div></div>');
    }
```

Section heading: "Use sparingly · 慎用" — TCM standard for herbs that need caution.

## TASK E — Section ordering verification

After the edits, the visual order in `renderAdvice()` should be:

1. **Lifestyle tips** (existing — unchanged)
2. **Avoid** (existing — unchanged) 
3. **Recommended foods** (existing — now filtered to regular items only)
4. **Limit · 少量** (NEW — appears only if `(less)` items exist)
5. **Recommended herbs** (existing — now filtered to regular items only)
6. **Use sparingly · 慎用** (NEW — appears only if `(less)` herbs exist; rare)

Verify the section order in the renderAdvice function preserves this. The new "Limit" section should appear immediately after "Recommended foods", and "Use sparingly" immediately after "Recommended herbs". This keeps related items visually grouped (foods together, herbs together).

## TASK F — Test scenarios

After deploy, manually verify:

1. **Test patient with "(less)" foods (the screenshot scenario):**
   - Open the patient with Balanced Constitution + the existing data
   - Doctor view → Constitution Questionnaire detail modal
   - RECOMMENDED FOODS section should show ONLY: Balanced diet, Seasonal vegetables & fruit, Polished rice & glutinous rice (粳米、糯米)
   - NEW "Limit · 少量" section should appear below RECOMMENDED FOODS, showing: Iced drinks, ice cream, cold raw foods (with amber background + dashed border)
   - The "(less)" prefix should be stripped from each chip

2. **Test patient WITHOUT "(less)" foods (regular case):**
   - Open any patient with no `(less)` items in their doctor_advice
   - "Limit · 少量" section should NOT appear (zero conditional render)
   - All food items should appear in RECOMMENDED FOODS as before

3. **Toggle EN/中:**
   - In EN mode: section heading shows "Limit · 少量" + helper "Consume in smaller amounts"
   - In 中 mode: same heading + helper text "建議減量食用"
   - Chip text flips language correctly (uses existing bilingual rendering)

4. **Edge cases:**
   - Item with both en + zh having "(less)" prefix → both stripped, displayed cleanly
   - Item with ONLY en having "(less)" prefix (zh doesn't) → still detected as reduce, both stripped
   - Item starting with "(粳米、糯米)" or other Chinese parens → NOT detected as reduce (correct — it's just botanical clarification, not a negative qualifier)
   - Empty foods array → no sections rendered (no empty Limit section)

## ACCEPTANCE CRITERIA

- New `detectReducePrefix()` helper function present and handles string + object formats
- Foods rendering splits items into regular (RECOMMENDED FOODS) and reduce (Limit · 少量) buckets
- Herbs rendering does the same split (defensive — for future data)
- "Limit · 少量" section uses amber background (#FFF3CD) and dashed border for visual distinction
- Section appears only when reduce-items exist (no empty section)
- "(less)" / "(reduce)" / "(limit)" / etc. prefixes stripped from displayed text
- EN/中 language toggle works on new sections (helper text translates)
- Snapshot saved at `briefs/snapshots/brief-14a-fix-3-pre-migration/`
- Patient view (wellness assessment portal) also benefits from the fix (since it shares `renderAdvice()`)
- No regressions on patients without `(less)` items

## REPORT BACK

```
Files modified:
  - v2/assets/js/components/constitution-card.js

Pushed to: [commit hash]

detectReducePrefix() helper added: [yes/no]
Foods split into regular + reduce: [yes/no]
Herbs split into regular + reduce: [yes/no]
Limit · 少量 section renders correctly: [yes/no]
Use sparingly · 慎用 section renders correctly (if any reduce-herbs exist): [yes/no]

Manual verification:
  Screenshot scenario (Balanced Constitution + (less) items):
    - Recommended foods shows only 3 items: [yes/no]
    - Limit section appears with 3 stripped items: [yes/no]
    - Amber background + dashed border applied: [yes/no]
  Regular patient (no (less) items):
    - Limit section does NOT appear: [yes/no]
  EN/中 toggle:
    - Helper text translates: [yes/no]
    - Chip text flips: [yes/no]

Browser console clean: [yes/no]

Anything that needs CEO attention: [list]
```

## ROLLBACK

```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-14a-fix-3-pre-migration
cp $SNAP/constitution-card.js /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js
git add -A
git commit -m "Rollback Brief #14a-fix-3"
git push
```

## NOTES

- This is a render-time fix. The underlying data (doctor_advice arrays in DB) is unchanged. Items are visually re-categorized at display time.
- The `detectReducePrefix()` patterns include Chinese qualifiers (少, 減, 忌, 避, 限) for future-proofing — if Chinese AI prompts generate `(少) 冰飲`, those will also be detected.
- The "Limit · 少量" wording was chosen because:
  - Universally understood by bilingual Malaysian TCM patients
  - Clearly between "recommended" and "avoid" in connotation
  - Matches Chinese clinical convention
  - Could rename later via small edit if CEO prefers different wording
- Color choice (#FFF3CD amber background, #B5881A dashed border, #6F5510 text) matches existing "preview banner" styling on v3 pages — consistent with HansMed brand
- **Day 2 tongue AI upgrade should fix the AI prompt** to put `(less)` items in `avoid` array directly. This brief handles legacy data; the AI prompt fix is the source-of-truth improvement.
- **Optional future cleanup (post-launch):** one-shot backend script that scans `doctor_advice.foods` arrays in DB and migrates `(less)` prefixed items to `avoid` arrays. Permanent data cleanup. ~1 hr backend work, low priority once this render-time fix ships.
