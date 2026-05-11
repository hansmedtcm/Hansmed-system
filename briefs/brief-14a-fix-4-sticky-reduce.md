# Brief #14a-fix-4 — Sticky Reduce Context (Constitution Card)

**Priority:** P1 — clinical display correctness
**Estimated effort:** 15-30 minutes
**Depends on:** Brief #14a-fix-3 (must be shipped first — it is)
**Blocks:** Patient soft launch

---

## Problem

Brief #14a-fix-3 correctly detects `(less)` / `(reduce)` / `(limit)` prefixes
on individual food and herb items, but historical `doctor_advice.foods` data
sometimes stores comma-grouped reduce items as separate array entries with
the prefix only on the FIRST one:

```
foods: [
  "Balanced diet",
  "Seasonal vegetables & fruit",
  "Polished rice & glutinous rice (粳米、糯米)",
  "(less) Iced drinks",     ← detected as REDUCE ✓
  "ice cream",               ← no prefix → wrongly RECOMMENDED ✗
  "cold raw foods"           ← no prefix → wrongly RECOMMENDED ✗
]
```

Result: "ice cream" and "cold raw foods" appear in the **Recommended Foods**
section of the constitution card — clinically misleading for cold-sensitive
patients.

## Goal

Make the reduce classifier "sticky": once a reduce prefix is encountered
during iteration of a foods or herbs array, ALL subsequent items in that
array inherit the reduce classification until the array ends.

This matches the real-world doctor data-entry pattern: recommendations are
listed first, "less of" / "avoid" items come at the end of the same list.

## File to modify

`v2/assets/js/components/constitution-card.js`

Specifically: the `renderAdvice()` function — the two `forEach` loops that
classify foods and herbs (currently around lines ~762 and ~789).

## Required change

Replace the two existing classification loops:

### BEFORE (foods loop)

```js
var regularFoods = [];
var reduceFoods  = [];
if (Array.isArray(adviceObj.foods)) {
  adviceObj.foods.forEach(function (f) {
    var d = detectReducePrefix(f);
    if (d.isReduce) reduceFoods.push(d.cleaned);
    else            regularFoods.push(f);
  });
}
```

### AFTER (foods loop — sticky)

```js
// Brief #14a-fix-4: sticky reduce context. Once a reduce prefix is
// detected, all subsequent items in the array inherit the reduce
// classification. Matches doctor data-entry pattern where reduce
// items are listed at the end of the array, prefixed only on the
// first member of the comma-grouped tail.
//   ["Yam", "(less) ice cream", "cold drinks"]
//   → "Yam" recommended, "ice cream" + "cold drinks" both reduce.
var regularFoods = [];
var reduceFoods  = [];
if (Array.isArray(adviceObj.foods)) {
  var stickyReduce = false;
  adviceObj.foods.forEach(function (f) {
    var d = detectReducePrefix(f);
    if (d.isReduce) {
      stickyReduce = true;
      reduceFoods.push(d.cleaned);
    } else if (stickyReduce) {
      // No explicit prefix on this item but we are in sticky reduce
      // mode — inherit the classification, push the item as-is
      // (no cleaning needed because there was nothing to strip).
      reduceFoods.push(f);
    } else {
      regularFoods.push(f);
    }
  });
}
```

### BEFORE (herbs loop)

```js
var regularHerbs = [];
var reduceHerbs  = [];
if (Array.isArray(adviceObj.herbs)) {
  adviceObj.herbs.forEach(function (h) {
    var d = detectReducePrefix(h);
    if (d.isReduce) reduceHerbs.push(d.cleaned);
    else            regularHerbs.push(h);
  });
}
```

### AFTER (herbs loop — sticky)

```js
// Brief #14a-fix-4: same sticky logic for herbs.
var regularHerbs = [];
var reduceHerbs  = [];
if (Array.isArray(adviceObj.herbs)) {
  var stickyReduceH = false;
  adviceObj.herbs.forEach(function (h) {
    var d = detectReducePrefix(h);
    if (d.isReduce) {
      stickyReduceH = true;
      reduceHerbs.push(d.cleaned);
    } else if (stickyReduceH) {
      reduceHerbs.push(h);
    } else {
      regularHerbs.push(h);
    }
  });
}
```

## Acceptance criteria

After this brief ships, refresh the patient who currently shows the bug
(Balanced Constitution patient with the `(less) Iced drinks` issue):

1. **RECOMMENDED FOODS section** shows ONLY:
   - Balanced diet
   - Seasonal vegetables & fruit
   - Polished rice & glutinous rice (粳米、糯米)
2. **LIMIT · 少量 section** shows:
   - Iced drinks
   - ice cream
   - cold raw foods
3. **Other constitutions** still render correctly:
   - Test at least one Yin Deficiency patient and one Yang Deficiency
     patient. Their foods/herbs should NOT be wrongly reclassified
     (because their HERB_MAP entries don't have any reduce prefixes —
     sticky mode only activates after a prefix is encountered).
4. **HERB_MAP-driven cards** (where data comes from constitution-card.js
   not from doctor_advice DB) still render unchanged because none of
   their entries have reduce prefixes.
5. **EN/中 toggle** continues to work in both Recommended and Limit
   sections — both languages render correctly.

## Edge case noted but accepted

If a doctor ever enters a foods array like:
```
["Yam", "(less) ice cream", "Spinach"]
```
"Spinach" will now be classified as reduce (sticky from the prior `(less)`
item). This is acceptable because:
- Real-world doctor entry rarely interleaves recommendations with reduces
- The error mode (a recommendation appearing as "limit") is far less harmful
  than the current bug (a reduce-item appearing as "recommended")
- A follow-up brief can add explicit "[recommend]" markers for interleaved
  cases, or migrate the underlying data structure

## Commit message

```
fix(constitution-card): sticky reduce context for foods/herbs

When a doctor_advice foods array stores comma-grouped reduce items
as separate entries with the prefix only on the first member,
inherit the reduce classification through the rest of the array.

Fixes: ice cream and cold raw foods appearing as RECOMMENDED FOODS
on Balanced Constitution patient cards.

Brief: #14a-fix-4
```

## Verification step (final task)

After the change is committed, take a screenshot of the same patient's
constitution card and confirm all three items (Iced drinks, ice cream,
cold raw foods) appear under "Limit · 少量" with the amber background.
Report success or paste the screenshot if it still looks wrong.

## Rollback

```
git revert <commit-sha>
```
The change is isolated to two loops in one file — clean rollback.
