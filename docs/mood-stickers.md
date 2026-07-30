# Mood sticker generation & integration

How LifeMap mood art is generated, processed, and wired into the app. Use this whenever adding new moods.

Related code:

| Piece | Path |
| --- | --- |
| Emotion catalog | `src/lib/moments/emotion-tokens.ts` |
| Variant helpers | `src/lib/moments/mood-art.ts` |
| Static `require()` map | `src/lib/moments/mood-art-assets.ts` |
| PNG assets | `assets/moods/<emotionId>/{male,female,cat,dog}.png` |
| Sheet → sticker script | `scripts/mood-stickers.py` |
| Picker UI | `src/components/capture/EmotionTokenPickerSheet.tsx` |
| Diary mood block | `src/components/capture/DiaryMoodBlock.tsx` |

---

## What a “mood” is in the app

Each mood has:

1. **Id** — lowercase slug (`sad`, `grateful`, …) in `EmotionTokenId`
2. **Label** — display name (`Sad`, `Grateful`, …)
3. **Emoji fallback** — still in `EMOTION_TOKENS` for legacy / a11y
4. **Tint** — soft background circle behind the sticker
5. **4 art variants** — `male`, `female`, `cat`, `dog` (user can switch; preference persisted in settings key `mood.art_variant`)

App display always uses the PNG via `getMoodArtPresentation(emotionId, variant).imageSource`.

Current count: **107 moods × 4 variants = 428 stickers**.

---

## Character lock (do not reinvent)

Every sheet must reuse the **same four characters** in **fixed positions**:

| Quadrant | Variant | Character |
| --- | --- | --- |
| Top-left | `male` | Young man, short brown hair, **blue** t-shirt |
| Top-right | `female` | Young woman, shoulder-length brown hair, **pink** t-shirt |
| Bottom-left | `cat` | Cream pointed-ear cat |
| Bottom-right | `dog` | Cream/tan floppy-ear puppy |

Style rules that must match existing assets:

- Soft flat / vector-like sticker illustration
- Thin **dark-brown** outlines (not pure black)
- Flat pastel colors, subtle shading, soft blush cheeks
- Head-and-shoulders bust, identical scale per tile
- Generous **pure white** margin; nothing touching quadrant edges
- No cards, shadows, grid lines, dividers, text, watermarks, or frames
- Cute / friendly journaling-app tone

**Reference images for generation:** attach any existing finished stickers, e.g.:

- `assets/moods/joyful/{male,female,cat,dog}.png`
- or a full sheet previously generated

Generation is done in Cursor with the **GenerateImage** tool (same pipeline used for the current set — not Gemini unless you choose to). Attach those four PNGs as `reference_image_paths`.

---

## Step-by-step: add one or more moods

### 1. Name the mood

Pick:

- `emotionId` — kebab-safe lowercase, no spaces (`homesick`)
- `label` — Title Case (`Homesick`)
- emoji + tint hex for `EMOTION_TOKENS`
- Whether a **tiny prop** helps (only if face alone is ambiguous — e.g. nostalgic photo, grateful sprout). Keep props small; face dominates.

### 2. Generate a 2×2 sheet

Use **GenerateImage** with `aspect_ratio: "1:1"` and the four joyful (or calm) stickers as references.

**Master prompt prefix** (paste every time):

```text
Create one square 2x2 character sheet. Match the attached LifeMap sticker references exactly and reuse the same four characters in fixed positions:
top-left young man with short brown hair and blue T-shirt,
top-right young woman with shoulder-length brown hair and pink T-shirt,
bottom-left cream pointed-ear cat,
bottom-right cream-and-tan floppy-ear puppy.
Same thin dark-brown outlines, flat pastel colors, rounded proportions, subtle flat shading and soft blush cheeks.
Complete centered head-and-shoulders busts at identical scale with generous pure-white margin; nothing cropped or touching quadrant boundaries.
Seamless pure white background; no cards, shadows, grids, dividers, text, watermark, borders, or frames.
Cute friendly sticker illustration for a journaling app, high clarity at small sticker size.
```

**Emotion-specific suffix** (example):

```text
Emotion: HOMESICK.
All four look softly homesick: distant eyes, gentle downturned brows, small wistful mouth.
Optional tiny prop: a small house silhouette near the chest — very small, face still dominates.
Distinct from sad (memory of home, not general sorrow) and lonely (place longing, not isolation).
```

Save the tool output (Cursor places it under the project assets cache). Prefer a clear filename like `mood-<emotionId>-sheet.png`.

**Tips that worked well:**

- Generate **one emotion per image** (better consistency than packing many moods)
- Batch several `GenerateImage` calls in parallel when adding multiple moods
- Reject sheets where a shirt/ear crosses into another quadrant — regenerate
- Reject sheets where characters drift (wrong hair, shirt color, dog becomes cat, etc.)

### 3. Split, remove background, soft-edge, export

```bash
# From repo root. Requires Python 3 + Pillow + NumPy.
python3 scripts/mood-stickers.py /path/to/mood-homesick-sheet.png homesick

# Custom order only if the sheet is not male,female,cat,dog:
python3 scripts/mood-stickers.py SHEET.png homesick --order male,female,cat,dog
```

This writes:

```text
assets/moods/homesick/male.png
assets/moods/homesick/female.png
assets/moods/homesick/cat.png
assets/moods/homesick/dog.png
```

Each file is **256×256 RGBA** with transparency and **soft alpha edges** (no hard cut, no white halo).

**What the script does:**

1. Flood-fill “bright + colourless” background from the image border (handles white *and* light gray cards/shadows)
2. Soft alpha along the silhouette (antialiased outline → partial coverage)
3. Unmultiply white so soft edges don’t keep a pale fringe
4. Content-aware quadrant split: connected opaque blobs are grouped by **centroid** so a blue shirt that slightly crosses the midline stays with the man, not the cat
5. Trim → square → resize in premultiplied space → PNG

Verify quickly:

```bash
python3 -c "
from pathlib import Path
from PIL import Image
for v in ['male','female','cat','dog']:
    p = Path('assets/moods/homesick')/f'{v}.png'
    im = Image.open(p)
    assert im.mode == 'RGBA' and im.size == (256, 256)
    assert im.getchannel('A').getextrema() == (0, 255)
print('ok')
"
```

### 4. Wire into the app

**A. `src/lib/moments/emotion-tokens.ts`**

- Add `'homesick'` to `EmotionTokenId` (keep alphabetical)
- Add `{ id: 'homesick', label: 'Homesick', sticker: '🏠', tint: '#…' }` to `EMOTION_TOKENS` (alphabetical by id)

**B. `src/lib/moments/mood-art-assets.ts`**

```ts
homesick: {
  male: require('../../../assets/moods/homesick/male.png'),
  female: require('../../../assets/moods/homesick/female.png'),
  cat: require('../../../assets/moods/homesick/cat.png'),
  dog: require('../../../assets/moods/homesick/dog.png'),
},
```

**C. Tests** — `__tests__/emotion-tokens.test.ts`

- Bump `toHaveLength(N)`
- Insert the new label in the expected alphabetized list

**D. Sanity**

```bash
pnpm exec tsc --noEmit -p tsconfig.json
pnpm exec jest __tests__/emotion-tokens.test.ts --runInBand
```

No migration needed for new moods — `mood_label` stores the **label string** (e.g. `"Homesick"`), not a DB enum.

### 5. Review in the app

Open Diary → mood picker → search the new label → flip Male / Female / Cat / Dog. Check compose block, diary list, and moment preview.

---

## Prompt recipes used for the “extra 8”

These were added after the original 31, with optional tiny props where useful:

| Id | Prop | Distinct from |
| --- | --- | --- |
| `grateful` | Tiny sprout in pot | content / satisfied |
| `hopeful` | none | joyful / calm |
| `curious` | Tiny magnifying glass | amazed / surprised |
| `loved` | Tiny heart badge | passionate / joyful |
| `frustrated` | none | annoyed / irritated / angry |
| `bored` | Tiny clock | indifferent |
| `guilty` | none | ashamed / embarrassed |
| `nostalgic` | Tiny vintage photo | sad / lonely |

## Hoffman expansion (46 moods)

Flat list only — feelings and body sensations share the same picker. Props only where face alone is ambiguous:

| Id | Prop | Distinct from |
| --- | --- | --- |
| `burnedout` | Tiny empty battery | tired / drained |
| `heartbroken` | Tiny broken heart | sad |
| `inspired` | Tiny lightbulb | hopeful / amazed |
| `safe` | Tiny shield | calm / peaceful |
| `frozen` | Tiny ice crystal | scared / cold |
| `heavy` | Tiny weight | sad / depressed |
| `knotted` | Tiny knot near chest | tense / anxious |
| `light` | Tiny feather | joyful / calm |

All other Hoffman-expansion moods: expression + posture only (no prop).

Added later:

| Id | Prop | Distinct from |
| --- | --- | --- |
| `motivated` | Tiny upward arrow | determined / energized / confident |
| `happy` | none | joyful / content / excited |
| `bitter` | none | resentful / angry / disappointed |
| `caring` | Tiny heart | affectionate / loved |
| `daring` | none | brave / confident |
| `empathy` | Tiny overlapping hearts | caring / loved |
| `furious` | none | angry / pissed |
| `grief` | none | heartbroken / sad / melancholy |
| `grounded` | Tiny rooted plant | calm / present / settled |
| `impatient` | Tiny hourglass | restless / frustrated / annoyed |
| `isolated` | none | lonely / empty |
| `lucky` | Tiny clover | happy / grateful / optimistic |
| `moody` | none | irritated / sad / bitter |
| `pissed` | none | angry / furious / irritated |
| `regret` | none | guilty / sorry / ashamed |
| `sorry` | none | guilty / regret / ashamed |
| `strong` | none | brave / confident / determined |
| `thankful` | none | grateful / lucky / content |
| `thrilled` | none | excited / joyful / amazed |
| `unhappy` | none | sad / depressed / upset |
| `upset` | none | unhappy / sad / frustrated |
| `worthy` | Tiny star badge | proud / confident / loved |

Reuse the master prefix + a clear “Emotion: …” paragraph + “Distinct from …” line every time.

---

## Sizes

| Stage | Size |
| --- | --- |
| Generated sheet | Square (tool default / 1:1) |
| Exported sticker | **256×256** PNG |
| In-app display | ~32–68 pt (256 is enough for @2x/@3x) |

Do not ship huge source PNGs into `assets/moods/` — always run the script.

---

## Asking Cursor later

When you want more moods, a message like this is enough:

> Add moods X, Y, Z using `docs/mood-stickers.md`. Generate sheets with GenerateImage + joyful references, run `scripts/mood-stickers.py`, wire tokens + assets, update tests.

The agent should **not** hand you Gemini-only prompts unless you ask — the established path is generate here → process with the script → integrate.

---

## Common failure modes

| Symptom | Fix |
| --- | --- |
| Hard cutout / jagged edge | Soft alpha path in script; don’t use binary matte tools |
| White halo around sticker | Script unmultiplies white; re-run script, don’t manually erase BG |
| Cat tile has blue shirt bleed | Content-aware split; regenerate sheet with more margin between characters |
| Wrong character in a quadrant | Regenerate; check `--order` only if layout changed |
| App doesn’t show new mood | Forgot `emotion-tokens.ts` and/or `mood-art-assets.ts` |
| Metro missing asset | Clean rebuild after adding PNGs under `assets/` |

---

## Persistence notes (product)

- Selected **variant** (male/female/cat/dog) is saved in settings (`mood.art_variant`) and survives app relaunch
- Selected **emotion** is stored per moment as `mood_label` (+ optional `mood_reason`, `mood_variant`)
- Picker search filters `EMOTION_TOKENS` by label/id
