# Personal analysis: `abc.json` (2026-06-04 export)

**Purpose:** Notes for us while building LifeMap — not app code, not shipped.  
**Source:** Settings → Export today → JSON (`abc.json`).  
**Times below:** Central (`America/Chicago`). June 4 = **CDT** (UTC−5).  
**Convert:** UTC `Z` + 5 hours → local (e.g. `06:36:29Z` → **1:36:29 AM CDT**).

---

## Export metadata

| | |
| --- | --- |
| Exported (UTC) | 2026-06-04T07:43:46Z |
| Exported (Central) | Jun 4, 2026, **2:43:46 AM CDT** |
| `dateKey` | 2026-06-04 |
| Raw `rowCount` | **57** |
| Logical saves (deduped) | **7** |

**Dedupe rule used here:** same `timestamp` + same lat/lng (5 decimals) = one save; merge `source` lists.

---

## What actually happened (plain English)

Roughly **1:07 hours** of data while you were almost certainly **still in one place** (coords ~33.25045, −97.15306 — Denton-area cluster). The phone did not take a real trip; it **pinged GPS/motion** a handful of times with long quiet gaps.

### Timeline of real saves (7)

| # | Central time | Sources | Notes |
| --- | --- | --- | --- |
| 1 | 1:36:29 AM | gps only | First save; **5 duplicate DB rows** (ids 515–519) |
| 2 | 1:55:36 AM | gps + motion | ~19 min later; **6 duplicate rows** |
| 3 | 2:02:07 AM | gps + motion | ~7 min later; **13 duplicate rows** |
| 4 | 2:14:01 AM | gps + motion | ~12 min later; **18 duplicate rows** (worst burst) |
| 5 | 2:31:13 AM | gps + motion | ~17 min later; **6 duplicate rows** |
| 6 | 2:36:43 AM | gps + motion | ~6 min later; **7 duplicate rows** |
| 7 | 2:43:15 AM | gps + motion | ~7 min later; **2 rows** (normal pair) |

Max movement between saves is on the order of **tens of meters** (GPS jitter), not a drive.

### Gaps (no row in DB)

| From | To | Gap |
| --- | --- | --- |
| 1:36 AM | 1:55 AM | 19 min |
| 1:55 AM | 2:02 AM | 7 min |
| 2:02 AM | 2:14 AM | 12 min |
| 2:14 AM | 2:31 AM | 17 min |
| 2:31 AM | 2:36 AM | 6 min |
| 2:36 AM | 2:43 AM | 7 min |

---

## Duplicate rows (why 57 ≠ 7)

Same instant, same coordinates, **different `id`** — often many `gps` rows plus one `motion`:

| Central time | Row count | Pattern |
| --- | --- | --- |
| 1:36:29 AM | 5 | gps ×5 |
| 1:55:36 AM | 6 | gps ×5 + motion |
| 2:02:07 AM | 13 | gps ×12 + motion |
| 2:14:01 AM | 18 | gps ×17 + motion |
| 2:31:13 AM | 6 | gps ×5 + motion |
| 2:36:43 AM | 7 | gps ×6 + motion |
| 2:43:15 AM | 2 | gps + motion (expected) |

**Hypothesis for engineering:** persist path or BG Geo callback may fire **multiple inserts per single fix** (retries, parallel handlers, or both `gps` and repeated `gps` without dedupe). Worth tracing `insertLocationPoint` and motion/GPS listeners — not fixing in this doc.

---

## What our *current* trip/history logic would do with this file

If we feed all 57 rows into `buildDayTimeline` (10 min gap / 10 min dwell / 150 m):

- We may get a **fake “Drive”** (~9 ft, few minutes) between jittery points — matches the “0 m / silly drive” complaints on the History bar.
- A **“Visit”** at the end is reasonable (same area, last segment).
- **Gaps** in the UI are time *between timeline entries*, not the same as “19 min with no rows” unless we align definitions.

**Takeaway:** timeline and export should probably **dedupe or collapse** same-timestamp/same-place rows *before* trip detection and before counting “saves.”

---

## Ideas for better code (backlog)

1. **Insert dedupe** — at most one row per `(timestamp_ms, rounded_lat, rounded_lng)` per session, or upsert; allow multiple sources in one row if needed.
2. **Trip detection input** — dedupe sorted points before `detectTrips` / `buildDayTimeline` (same rule as this analysis).
3. **Meaningful travel** — keep filtering sub‑40 m / short “drives” when points are essentially stationary (already started; validate with this file).
4. **History scrub** — segment positions from **deduped** timeline; card should not show a drive when scrub lands on noise.
5. **Export for humans** — optional second file or comment in docs: “raw DB rows; dedupe for analysis.” No need for a `location-export-readable` module unless we want it later.
6. **Display timezone** — app UI uses device local time; exports stay UTC ISO (fine). For personal `.md` notes, always label Central/CDT when analyzing Texas data.

---

## Sample row (reference)

```json
{
  "id": 515,
  "timestamp": "2026-06-04T06:36:29.000Z",
  "lat": 33.25045409221947,
  "lng": -97.15305928448834,
  "accuracy": 7.6,
  "source": "gps"
}
```

→ **1:36:29 AM CDT**, ~7.6 m accuracy, stationary cluster.

---

## FAQ (Jun 4 session — “I’m still at home”)

### 1. Why so many duplicate rows?

**The database has no dedupe.** Every callback calls `insertLocationPoint` and always creates a new row ([`location-points.ts`](src/db/repositories/location-points.ts)).

**Several writers can fire for one real-world moment:**

| Path | Source tag | Behavior |
| --- | --- | --- |
| `onLocation` | `gps` | Saves when you moved ≥25 m, or scheduler flush (30 s window on `d25_s30`) |
| `onMotionChange` | `motion` | **Always** force-saves when motion starts/stops ([`transistorsoft-location-service.ts`](src/location/transistorsoft-location-service.ts) ~174–184) |
| `onHeartbeat` | `heartbeat_ping` / `gps` | Stationary ping after 30 min, or flush of `latestLocation` |

So **gps + motion** at the same second is expected (2 rows). Your export shows **5–17 `gps` rows at the same timestamp** — that is not expected.

**Likely cause of gps×N:** `onLocation` handlers running **in parallel** before `lastPersistedCoords` is updated. Each concurrent call thinks it should save → N identical inserts. The persist scheduler only limits “one flush per window”; it does **not** serialize overlapping `writeLocationToDatabase` calls.

**Not caused by:** trip detection or History UI (they only read rows).

---

### 2. Why isn’t the bar one orange segment from 1:36 AM → now (~2:54 AM)?

**What you want:** One **Visit** from first save at home until **now** (orange to the green “now” line).

**What the code does instead** (with your 7 real saves, same ~150 m radius):

1. **`splitByTimeGap(10 min)`** ([`trip-detection.ts`](src/lib/trip-detection.ts)) cuts the day whenever pings are **>10 minutes** apart:
   - 1:36 → alone  
   - 1:55 + 2:02 → chunk  
   - 2:14 → alone  
   - 2:31 + 2:36 + 2:43 → chunk  

   So the algorithm **never sees** 1:36 → 2:54 as one continuous block.

2. **`dwellMinutes: 10`** — a **Visit** needs **≥10 minutes between first and last point in the same chunk** within 150 m.  
   - Chunk `1:55 → 2:02` is only **7 minutes** → classified as **travel** (a few meters), not visit.  
   - Chunk `1:36` is a single instant → tiny visit ending at 1:36.  

3. **`mergeSameAreaTrips`** — when a stay is followed by a “travel” leg, it **ends the visit at travel start** (~1:55), even if that travel is GPS noise.

4. **`refineTrip`** may drop the fake drive, but you can still end up with **two orange segments** (e.g. ~1:36–1:55 and ~2:14–now) and **empty gray bar** between them — not one bar from 1:36 to now.

5. **`isVisitOngoing`** ([`trip-format.ts`](src/lib/trip-format.ts)) only stretches the **last** visit’s end to `now` if the last save was **<20 min** ago. It does **not** merge earlier chunks or extend the **first** visit from 1:36.

6. **57 raw rows** (not 7) make this worse: extra points inside a chunk create more micro-**travel** segments and wrong History card/scrub behavior.

**Bottom line:** You were home the whole time; the **ping schedule** (sparse, 7–19 min gaps) plus **10 min gap + 10 min dwell** rules **forbid** one long visit. Life360-style “here since 1:36 AM (still here)” needs different rules: same-area pings → extend one visit; gap split only when the **next** save is **far away**, not when time alone is >10 min.

---

### Trip model (rebuilt in code)

`trip-detection.ts` now uses **stay → trip → stay**:

- **Stay:** consecutive saves in the same area (chain within 150 m); ≥10 min span or last cluster of the day (open visit). Time gaps at home do **not** split the stay.
- **Trip:** saves from the moment you leave until the next stay starts.
- **Gap:** only between disconnected timeline entries (missing DB rows + far next save), not between stay→trip.

Your `abc.json` deduped to 7 saves → **one stay** for the whole home session (not 5 orange chunks + fake drives).

---

*Last updated from manual review of `abc.json`. Regenerate this doc by hand if you export again.*
