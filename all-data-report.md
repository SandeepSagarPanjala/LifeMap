# Analysis: `all data.json` (549 rows, exported Jun 4, 3:31 AM CDT)

This matches what the app does: **`getAllLocationPoints()` → `buildDayTimeline()`** (entire DB, not “today” only). Badge = count of **Visit** (`stay`) entries.

Settings assumed: **10 min dwell**, **25 m radius** (your default).

---

## Why the badge still shows **3**

| Metric | Value |
|--------|--------|
| Raw DB rows | 549 |
| After dedupe (same time + place) | **167** |
| **Visits detected** | **3** |
| Drives | 2 |

The badge is correct for the current algorithm — it is not counting drives or duplicates.

### The three visits (25 m)

| # | Start (Central) | End (Central) | Saves | Notes |
|---|-----------------|---------------|-------|--------|
| 1 | **Jun 3, 4:27 PM** | Jun 3, 5:47 PM | 16 | Home cluster |
| 2 | **Jun 3, 7:16 PM** | Jun 3, 9:29 PM | 14 | Home — matches your “~7 PM” arrival |
| 3 | **Jun 3, 10:20 PM** | Jun 4, 3:11 AM | 13 | **Open visit** (what the map card shows) |

Jun 4 “today” alone has only **10** deduped saves and **1** visit — so if you only looked at today’s calendar day you would expect **1**, but History uses **all** points since install.

---

## Why it says **“Here from 10:20 PM”** (not ~7 PM)

The UI always uses the **current open visit** = the **last** stay in the timeline. That visit’s start is the **first save in that cluster** (id **469** at `2026-06-04T03:20:43Z` → **10:20 PM** Jun 3 Central).

You **did** get a visit starting near **7 PM** — that is **Visit 2** (anchor id **315**, **7:16 PM**). The app does not merge it into the open card because the algorithm started a **new** stay at 10:20 PM.

### What split home into three visits

1. **Visit 1 → Visit 2 (5:47 PM → 7:16 PM)**  
   Real gap: you were away or GPS left the 25 m anchor (e.g. outing). New cluster at 7:16 PM is correct as a separate segment.

2. **Visit 2 → Visit 3 (9:29 PM → 10:20 PM)** — main issue  
   **No location rows at all** for ~51 minutes, then pings resume at home.  
   The detector only chains **consecutive** saves within 25 m of each segment’s **anchor**. A time hole with **zero** saves ends the cluster; the next ping starts a **new** visit at **10:20 PM**, even though you were still at home.

So **10:20 PM** is “first GPS save after the gap,” not “when you arrived home.”

### If you use 150 m radius in Settings

Timeline becomes **3 visits** still, but the **open** visit would show **“Here from 6:44 PM”** (one long home block from 6:44 PM → 3:11 AM). Wider radius merges more pings but does not fix the 9:29–10:20 **no-data** split at 25 m.

---

## Data quality (still relevant)

- Many rows are **duplicates** (same timestamp + coordinates, different ids / `gps` + `motion`).
- Dedupe collapses 549 → **167** logical saves before detection.
- Home coordinates cluster around **33.25045, -97.15306** (Discovery Park area).

---

## Jun 3 vs Jun 4 calendar

| Day (Central) | Raw rows | Deduped | Visits @ 25 m |
|---------------|----------|---------|----------------|
| Jun 3 | 442 | 157 | 3 (all above) |
| Jun 4 | 107 | 10 | 1 (1:36 AM – 3:11 AM only) |

First save near home on Jun 3: **4:27 PM**. Last near home before midnight: **11:12 PM**.

---

## What would fix this (product / code)

1. **Merge stays** when the last point of visit A and the first point of visit B are within dwell radius (same place), even if there was a **time gap with no rows**.
2. **Open visit label**: optionally show start of **earliest** merged same-place stay, or “Since 7:16 PM” when continuing home after a short gap.
3. **History scope** (optional): badge for “Today” only vs all-time — today would show **1** with current data.

---

## Reproduce

```bash
npx tsx scripts/analyze-export-full.ts
```

Uses the same `buildDayTimeline` / `buildTripDetectionConfig` as the app.
