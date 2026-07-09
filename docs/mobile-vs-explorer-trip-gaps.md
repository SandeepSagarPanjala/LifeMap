# Mobile vs Points Explorer — trip gaps (Jun 23, 2026)

**Status:** Documented for investigation. Not fixing yet.

Two issues appear on **mobile only**, not in Points Explorer when fed the same `location_points`:

1. **Straight fake-line drives** (phantom Home→Desi 11:37 AM, Whole Foods→Home 8:19 PM)
2. **Missing Natural Groceries stay** (explorer segment 11, 8:09–8:19 PM)

---

## Same input, different output

| Source                                      | Trip/segment count | Natural Groceries stay (8:09–8:19 PM) | Phantom 11:37 AM drive             |
| ------------------------------------------- | ------------------ | ------------------------------------- | ---------------------------------- |
| Points Explorer (fresh `detectTripsForDay`) | **13**             | ✅ Present                            | ✅ Visible (Home→Home micro-drive) |
| Mobile DB (`mobile-trips.json` export)      | **11**             | ❌ Missing                            | ✅ Persisted as `travel` #2        |

Mobile stored timeline (from `__personal__/mobile-trips.json`):

```
 1. stay   Home          12:00 AM – 11:39 AM
 2. travel Home          11:37 AM – 11:43 AM   ← phantom
 3. travel Home          1:52 PM – 2:38 PM     ← real morning drive
 4. stay   (unlabeled)   2:38 PM – 2:51 PM
 5. travel Work          2:50 PM – 3:01 PM
 6. stay   Work          3:01 PM – 6:57 PM
 7. travel Work          6:57 PM – 7:08 PM
 8. stay   (unlabeled)   7:08 PM – 7:25 PM     ← Whole Foods area
 9. travel (unlabeled)   7:25 PM – 8:09 PM     ← should split at Natural Groceries
10. travel Home          8:19 PM – 8:23 PM     ← phantom short hop
11. stay   (unlabeled)   8:23 PM – 9:32 PM
```

Explorer adds, among others:

- **Stay Home 11:43 AM – 1:54 PM** between phantom drive and real drive
- **Stay Natural Groceries 8:09 PM – 8:19 PM** between evening drive and short hop home

---

## Core finding: same detection math, different execution path

### Points Explorer

1. Loads **all** `location_points` for the day (plus prev/next day window).
2. Runs **`detectTripsForDay` → `detectTrips` → `buildTripSegments`** in one batch.
3. Draws drive polylines from **segment GPS points** directly.

### Mobile (today)

1. **`syncTodayTrips`** loads **persisted `trips` + `trip_points`** from SQLite first (`loadHistoryFromStoredTrips`).
2. On map open, often **`displayOnly: true`** → show stored rows immediately, schedule background incremental sync.
3. New GPS is handled by **`refreshTodayTripsIncremental`**:
   - Extend open stay, or
   - **Tail-detect** only on points **after `sealedThroughMs`** (last sealed trip `endAt`).
4. Segments sealed earlier in the day are **not re-run** through full-day `detectTripsForDay`.

Relevant code:

- `src/lib/today-sync.ts` — `syncTodayTrips`, `refreshTodayTripsIncremental`, `tryTailMergeToday`
- `src/lib/today-sealed-history.ts` — `sealedThroughMs`, `mergeSealedAndLiveTimeline`
- `src/lib/trip-materialization.ts` — `loadHistoryFromStoredTrips` (past days also read stored rows)
- `src/lib/explorer-day-trips.ts` — batch path used by explorer + `materializePastDayFromGps`

**Implication:** Explorer answers “what should the whole day look like?” Mobile often answers “what did we already commit to the DB, plus a tail patch?”

---

## Issue 1 — Straight fake-line drives

### A. Phantom trips in the DB (detection + incremental seal)

**11:37 AM Home → Desi (6 min, ~4,500 ft)**

- GPS in that window: user **never left home** (all points ~33.250, -97.153).
- `motion_departure` fired every ~90s while stationary.
- Incremental materialization still created and **sealed** a `travel` row before the real 1:52 PM drive.

**8:19 PM Whole Foods → Home (4 min, ~2.2 mi)**

- Short hop with real movement (~2.8 km), but user’s actual errand was Whole Foods → **Natural Groceries** → Home.
- Explorer keeps NG as its own stay; mobile merged the 7:25–8:09 drive and never split out NG.

### B. Map-only chord lines (mobile `TripRouteOverlay`)

Even when trip **distance** is small (GPS path at home), the **map** can draw a long straight line because:

- `TripRouteOverlay` appends **`routeEnd`** (destination stay / saved-place pin) when GPS never got within 8m of that pin.
- Labels say “Desi District” / “Home” while GPS never went there → **chord from cluster to pin**.

Explorer does not use this overlay; it plots the drive segment’s own points.

Code: `src/components/map/TripRouteOverlay.tsx` (`routeLineCoordinates`, `line.push(routeEnd)`).

---

## Issue 2 — Natural Groceries stay missing on mobile

### What explorer sees

Evening sequence:

1. Stay Whole Foods area (7:08–7:25)
2. Drive (7:25–8:09) — GPS passes through / into Natural Groceries parking
3. **Stay Natural Groceries (8:09–8:19)** — cluster of points in lot (user screenshot)
4. Drive to Home (8:19–8:23)

### What mobile persisted

1. Stay 7:08–7:25 ✅
2. **Single travel 7:25–8:09** — end time equals NG arrival, but **no stay row**
3. Travel 8:19–8:23 (phantom) ✅
4. Stay from 8:23 ✅

### Likely mechanism

When travel #9 was sealed (~8:09 PM), tail detection had not yet classified the parking lot cluster as a **stop**. Later points would only be processed in the **tail window after `sealedThroughMs`**. That cannot **insert** a new stay **inside** an already-sealed drive.

Full batch detection on the complete day **does** see the 8:09–8:19 cluster as a stop → explorer segment 11.

---

## Detection algorithm notes

- Mobile app code path uses `src/lib/segmentation/*` via `buildSegmentationTimeline` / `buildExplorerDayTimeline`.
- Points Explorer has a **forked copy** under `point-explorer/src/lib/` (imports differ; core logic largely the same).
- Past-day rebuild (`materializePastDayFromGps`) **does** use the explorer batch path — **today** is the special incremental case.

---

## Open questions for later fixes

1. **Re-detect today on seal boundaries** — should we periodically run full-day `detectTripsForDay` and replace stored trips when fingerprint changes?
2. **Stricter `isRealDrive`** — suppress micro-drives with no displacement (home jitter + `motion_departure`).
3. **Don’t seal phantom travels** — minimum path length / displacement before persisting `travel`.
4. **TripRouteOverlay** — never chord to destination pin unless GPS entered destination radius; or hide route when `isSparseTravelRoute`.
5. **Split sealed drives** — if tail detection finds a stop mid-route, allow rewriting last sealed travel (expensive; needs design).
6. **Verify with test** — run `buildExplorerDayTimeline` on `mobile-trips.json` location_points and assert 13 segments match explorer (regression fixture).

---

## Repro data

- `__personal__/all data.json` — location_points only (Jun 23)
- `__personal__/mobile-trips.json` — location_points + **trips** + **trip_points** (11 trips)

To validate a fix: export should show **11 → 13** trips aligned with explorer, and map should not draw cross-city chords for phantom drives.

---

## User’s actual day (reference)

Morning: Home → Desi District → Office  
Evening: Office → Whole Foods → Natural Groceries → Home

Correct explorer drives: #4 (1:52 PM, 55 km), #10 (7:25 PM, 51 km)  
Wrong mobile artifacts: sealed phantoms + missing NG stay + overlay chords
