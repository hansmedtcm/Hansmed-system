# HansMed v3 — Image Generation Prompt Pack (v4 — stable / production use)

For use with GPT Image 2.0 / DALL-E 3 / similar. Each prompt below already includes anti-failure language (white balance, hands, anti-stock, anti-corporate). Generate, review, regenerate as needed.

---

## 🌿 Global style — append to EVERY prompt

```
Style: photorealistic editorial photography, warm natural light (golden hour or soft window light), white balance slightly warm (not orange), natural skin tones preserved, shallow depth of field, muted color palette of warm earth tones (burnt sienna, soft cream, weathered gold, ink black, dusty rose), slightly desaturated film look, subtle grain. Composition: clean, intentional minimalism, rule-of-thirds, generous negative space, slight asymmetry, candid and unposed. Mood: calm, contemplative, trustworthy, quietly luxurious. Cultural register: modern East Asian, timeless, refined. Consistency: consistent color grading across series, cohesive visual identity, same lighting tone across all images. Avoid: stock photo look, posed smiles, harsh lighting, neon or saturated colors, corporate office, western clinical aesthetic, plastic skin, over-retouched faces, branding, text overlays.
```

---

## 🖼 1. Hero — `hero-bg.jpg`

```
Atmospheric overhead close-up of a traditional Chinese tea ceremony in progress. Hand-thrown ceramic teacups, a small clay teapot, loose dried tea leaves and a few dried flowers scattered on a dark walnut wood table. Steam rising gently from one cup. Soft side window light casting long shadows, slightly dim cinematic environment. Background softly out of focus. No people. Composition leaves generous negative space on the right side for text overlay. Not a commercial product shot, no packaging, no branding.
```
Style: append global

## 🤲 2. Brand Story — `brand-story.jpg`

```
Close-up of a Traditional Chinese Medicine practitioner's hands gently taking a patient's pulse at the wrist. Practitioner wearing simple dark linen. Patient's wrist resting on a small deep burgundy silk pillow. Wooden table surface. Hands are natural and relaxed, intimate moment, unhurried. No faces visible, frame ends at wrists. Anatomically correct hands, natural finger positioning, no extra fingers. Visible skin texture, subtle wrinkles, realistic age detail. Soft warm light from a paper-screen window in the background.
```
Style: append global

## 📱 3. AI Wellness — `service-wellness.jpg`

```
Young Malaysian Chinese woman (~30), side three-quarter angle, holding a smartphone at eye level as if doing a wellness scan. Neutral, introspective expression, not performing for camera. Wearing soft cream linen blouse, natural appearance, minimal makeup. Phone held with both hands, screen softly glowing but not legible. Background: warm beige interior, wooden window frame, morning light. Candid moment, not posed, not influencer style.
```
Style: append global

## 💻 4. Consultation — `service-consultation.jpg`

```
Over-the-shoulder view of a TCM practitioner in a simple dark linen jacket sitting at a wooden desk using a laptop for a video consultation. Screen shows a softly blurred Malaysian Chinese patient at home, relaxed and natural. On desk: handwritten Chinese notes, calligraphy pen, tea cup with steam, a few traditional books. Soft side window light, intimate workspace. No corporate office, no headset, no business attire. Focus on warmth of human interaction, not technology.
```
Style: append global

## 🌿 5. Herb Shop — `service-shop.jpg`

```
Top-down flat-lay of dried Chinese medicinal herbs arranged organically on a dark wooden tray and warm cream linen cloth. Includes goji berries, ginseng slices, jujube dates, chrysanthemum flowers, cinnamon bark, licorice root. Small ceramic dishes, a traditional brass scale, wooden pestle partially visible. Layout slightly imperfect, not symmetrical, natural arrangement. Soft warm light from upper left. No packaging, no branding.
```
Style: append global

## 🌼 6. Step 1 Discover — `step1-discover.jpg`

```
Smartphone resting on a warm cream linen surface. Screen softly glowing (not readable). Beside it: dried chrysanthemum flowers, mint sprig, small ceramic cup. Top-down slightly angled view. Minimalist still life, calm beginning feeling.
```
Style: append global

## 🗣 7. Step 2 Talk — `step2-talk.jpg`

```
Laptop on wooden desk showing a video call with a softly blurred person. Beside it: notebook with handwritten Chinese calligraphy, fountain pen, steaming porcelain teacup. Soft warm backlight from window. Slight side angle, intimate workspace. Emphasis on quiet, attentive conversation.
```
Style: append global

## 📦 8. Step 3 Receive — `step3-receive.jpg`

```
Close-up of a hand opening a paper-wrapped package containing small kraft herb pouches. Each pouch tied with twine and labeled with handwritten Chinese characters. On warm cream linen surface, with ceramic mortar and pestle nearby. Handcrafted feel, not commercial packaging, no branding. Natural hand posture, anatomically correct fingers. Soft side light.
```
Style: append global

## 🏥 9. Practitioner Space — `practitioner-placeholder.jpg`

```
Empty traditional Chinese medicine consultation room. Wooden chair with burgundy cushion, small side table with calligraphy tools, folded cloth, pulse pillow. Background cabinet with many small labeled herb drawers. Clean but lived-in, authentic environment. Soft warm window light. No people.
```
Style: append global

## 📖 10. Patient Stories — `patient-stories-placeholder.jpg`

```
Quiet still life: open notebook with faint handwritten lines (not readable), steaming porcelain teacup, jujube date and dried herb on the page. Soft window light with visible dust particles. Large empty wooden table extending to the right for negative space. Mood reflective, calm, hopeful.
```
Style: append global

---

## 🧩 Bonus textures

**`texture-rice-paper.jpg`**
```
Macro close-up of traditional Chinese rice paper texture, warm cream tone, visible natural fibers, evenly lit, no marks. Style: minimal, neutral, photorealistic.
```

**`texture-ink-wash.jpg`**
```
Single horizontal Chinese ink brushstroke on cream paper, soft edges, organic flow, no text. Style: minimal, artistic, balanced negative space.
```

---

## ⚡ Generation strategy

For each image:
1. Generate 3–5 takes
2. Pick the strongest
3. If a take fails, add one of these fix phrases and re-generate:
   - "softer light"
   - "more natural skin texture"
   - "less contrast"
   - "less staged"
   - "more candid"

## 🧠 Pro tip — series consistency

After your Hero (#1) is finalized:
- Save it as a reference image in your tool (GPT Image 2.0 / DALL-E 3 supports image references)
- For all subsequent prompts, attach the Hero as reference and add this line: `match the lighting and color tone of the reference image`
- Result: the whole series looks like one photographer shot it, not twelve separate AI takes

---

## ✅ When all images are done

1. Drop them into `v3/assets/img/` with the filenames above
2. Compress lightly (JPEG ~85% quality, max width 1600px) — TinyPNG or Squoosh
3. Tell me "images done" — I write Brief #8 (smooth scroll + scroll-reveal animations + parallax + tilt-on-hover cards + slot the imagery into v3/index.html)

Estimated generation cost: ~$1-2 USD across all takes. Estimated time: ~60-90 minutes.
