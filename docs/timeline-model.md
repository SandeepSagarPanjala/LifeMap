# Timeline model — drives, visits, continuity

**This is the product contract for orange (visit) and blue (drive) cards.**  
Implementation lives in `src/lib/trip-detection.ts`. Bump `TRIP_DETECTION_VERSION` in `src/lib/trip-settings.ts` when these rules change.

---

## The four rules (non‑negotiable)

### 1. Alternating pattern only

The day timeline must **alternate** drive and visit. You cannot stack the same kind twice.

| Valid                         | Invalid           |
| ----------------------------- | ----------------- |
| drive → visit → drive → visit | drive → **drive** |
| visit → drive → visit → drive | visit → **visit** |

Real life is always: leave somewhere (drive), arrive somewhere (visit), leave again (drive), and so on.

If detection produces two drives or two visits in a row, that is a **bug** — merge, reclassify, or insert the missing leg before showing the timeline.

**Saved places (Home, Work, favorites):** a brief stop at a saved pin counts as a visit at **≥ 1 minute** and must **never** be dropped as “mid-drive noise” between two drives.

**Saved-place departure vs GPS envelope:** generic “spread envelope” stays must not extend past a saved-place visit end (e.g. Shay ends 10:09 PM — do not swallow the next hour of pings still within 250 m drift). Mid-route venue stops (Slim Chickens, Tesla lot) stay as their own visit cards.

### 2. Drive = moving fast

A **drive** is when the user is **moving quickly** between places.

Signals (use several, not one):

- GPS `speed` above walking pace when available
- **Implied speed** between saves: distance ÷ time
- Path distance large enough to leave the previous area
- Continuous movement between visit anchors

Thresholds in code today:

| Signal                  | Constant                                              | Notes                                                    |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Parked / arrival        | `VISIT_ARRIVAL_SPEED_MS` = **2 m/s**                  | At or below → visit boundary, not drive                  |
| Meaningful drive (long) | `MIN_MEANINGFUL_DRIVE_IMPLIED_KMH` = **8 km/h**       | Long hops slower than this are tracking gaps, not drives |
| Departure hop           | `MIN_DEPARTURE_SPEED_KMH` – `MAX_DEPARTURE_SPEED_KMH` | 2.5–80 km/h, 80–800 m in ≤ 5 min                         |

Jitter at one address is **not** a drive.

### 3. Visit = slow movement inside one area

A **visit** is when the user is **still or walking slowly** and stays **within one place envelope** (same radius / venue spread).

Signals:

- Low speed (≤ ~2 m/s) on arrival saves
- Points stay within **dwell radius** (20 m pin) or **venue envelope** (mall / campus spread up to ~400 m)
- Long path with **bounded spread** (walking a mall) = one visit, not a drive
- Minimum dwell time (`DEFAULT_TRIP_DWELL_MINUTES`, default **5 min**) unless saved Home/Work (1 min)

Walking around a store for 500 m is still **one visit** if spread stays inside the venue envelope.

### 4. Time continuity

Adjacent cards must **meet exactly** — no overlap, no hole between a drive and the next visit (and vice versa).

Example:

```
1:00 PM ───────── 2:00 PM  drive
2:00 PM ───────── 3:00 PM  visit
3:00 PM ───────── 4:00 PM  drive
```

- Drive **ends** when the visit **starts** (arrival save).
- Visit **ends** when the next drive **starts** (departure save).
- `enforceAdjacentContinuity()` + `snapDriveVisitBoundaries()` enforce this after detection.

**Gaps** (no GPS rows) may appear only between **same-kind** segments we could not fix (rare) or at the start/end of the day — never between a drive and its adjoining visit.

---

## Sparse GPS — do not lie on the map

When tracking only captured a **few points** on a long trip (straight chord, not road-following):

- Do **not** draw a route polyline (`isSparseTravelRoute()`).
- A bridge drive may still exist on the **timeline** for alternation, but the map shows **endpoints only**.

---

## Pipeline (detection order)

```
GPS points (time-ordered)
  → dedupe
  → find stay spans (slow / bounded spread + dwell)
  → slice travel between stays
  → isMeaningfulTravel (distance + speed + point count)
  → split mid-route stops, peel venue walks
  → merge same-area visits
  → normalize visit/drive boundaries (arrival / departure saves)
  → close visit end at next departure
  → enforce strict alternation (merge drive-drive, fix visit-visit)
  → snap drive↔visit times (continuity)
  → drop noise travels
```

---

## Related docs

- [`tracking-reliability-plan.md`](./tracking-reliability-plan.md) — capturing more GPS points (SDK, heartbeat, geofence).
- [`how-location-saving-works.md`](./how-location-saving-works.md) — when rows are written to SQLite.
