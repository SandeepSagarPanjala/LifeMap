# Past days — load path audit

**Status:** Documented for later review. No changes implemented yet.

Benchmark (Power mode) showed past-day work is dominated by **SQLite read + assembly**, not re-running `detectTripsForDay` on every map open. This doc captures what the map actually does for **past calendar days** (not today), what works, and known burdens.

Related: [`mobile-vs-explorer-trip-gaps.md`](./mobile-vs-explorer-trip-gaps.md) (today incremental vs batch detection).

---

## What past days do right

**Happy path** (day already materialized in `trips` + `trip_points`):

```
useHistoryForDay
  → in-memory cache hit? → instant (if day still in RAM cache)
  → else fingerprint check (~6 light COUNT queries)
  → listTripsForDay + listTripPointsForDay
  → buildTimelineFromStoredTrips (in-memory assembly)
  → map: DayJourneyOverlay from stored trip_points
```

- **No** `detectTripsForDay` on each open.
- **No** `prepareDayHistoryTimeline` on each open.
- **No** incremental tail merge / seal logic (today only).

Relevant code:

- `src/hooks/use-history-data.ts` — `useHistoryForDay`, debounce, cache peek for past days
- `src/lib/trip-materialization.ts` — `loadHistoryForSelectedDay`, `loadHistoryFromStoredTrips`
- `src/lib/history-data-cache.ts` — 2-entry RAM cache (today pinned + one browsed day)
- `src/components/map/DayJourneyOverlay.tsx` — default map routes from stored trips

---

## Seven issues / burdens (past days only)

### 1. Map flash when switching to an uncached day (UX)

When the user taps ←/→ to a day **not** in the 2-entry RAM cache:

1. `selectedDateKey` updates immediately.
2. `historyData` still holds the **previous** day → `historyDayLoaded = false`.
3. `showDayJourney` turns off → drive/stay overlays disappear.
4. `MapDayLoadingOverlay` (“Loading your day…”) appears.
5. After **300ms debounce** + DB load, routes return.
6. Map runs `animateToRegion(..., 400ms)`.

**Revisit of a cached past day:** sync is skipped entirely — no flicker.

Code: `use-map-screen-controller.ts` (`historyDayLoaded`, `showDayJourney`, `historyBlockingLoader`), `MapDayLoadingOverlay.tsx`.

---

### 2. Fingerprint check on every cache miss (moderate DB tax)

On cache miss, `syncHistoryForDay` always runs `getDayHistoryFingerprint` before loading:

- GPS day COUNT (`getLocationDayFingerprint`)
- Moments day fingerprint
- `materialized_days` row
- `countTripsForDay`
- `countTripPointsForDay`
- Geometry settings fingerprint

Roughly **6 SQLite round-trips** to validate cache — cheap vs full detection, but not free. Runs whenever a day falls out of the 2-slot RAM cache.

Code: `src/lib/history-fingerprint.ts`, `src/hooks/use-history-data.ts` (`syncHistoryForDay`).

---

### 3. Duplicate `trip_points` read (small waste)

On the stored load path:

1. `pastDayCanLoadFromStore` → `listTripPointsForDay(dateKey)`
2. `loadHistoryFromStoredTrips` → **`listTripPointsForDay(dateKey)` again**

Same day's points are read **twice** on cache miss. Still far below algorithm cost, but noticeable on heavy days (e.g. 6k+ points).

Code: `src/lib/trip-materialization.ts`.

---

### 4. Rare expensive fallback: full rematerialize

If a past day has **no trips**, **stale `TRIP_DETECTION_VERSION`**, or **missing stored geometry**:

```
materializePastDayFromGps
  → buildExplorerDayTimelineFromGps (full detectTripsForDay on GPS window)
  → persistClosedTripsIncremental (full replace)
```

This is the **~1–2s benchmark-class path**, one-time per day when the store is invalid. Expected on detection version bumps; should not run on every routine open.

Code: `src/lib/trip-materialization.ts` (`materializePastDayFromGps`, `loadHistoryForSelectedDay`).

---

### 5. Map render cost (not algorithm, but real)

Default past-day map uses `DayJourneyOverlay`:

- One polyline per drive (`RoutePathOverlay`) + stay areas.
- Busy day → many polylines + large `trip_points` deserialize.

No re-detection, but **map/GPU work** scales with trip and point count.

Code: `DayJourneyOverlay.tsx`, `RoutePathOverlay.tsx`.

---

### 6. Frozen wrong data (data fault, not perf)

Past days display **what was persisted** when the day was materialized. If a day was sealed incorrectly while it was still “today” (incremental sync), the past-day read path will keep serving that until rematerialize or force refresh.

Default journey view uses **stored `trip_points`** (usually faithful). **History panel** selected-drive mode uses `TripRouteOverlay`, which can draw chords to saved-place pins — a separate display issue.

See: [`mobile-vs-explorer-trip-gaps.md`](./mobile-vs-explorer-trip-gaps.md).

---

### 7. Small RAM cache (2 days)

`HISTORY_DATA_CACHE_MAX_ENTRIES = 2` — today is pinned; one other browsed day is kept. Scrolling through many past days **evicts** earlier entries → fingerprint + load again. Intentional for RAM; explains occasional reloads.

Code: `src/lib/history-data-cache.ts`.

---

## What we did **not** find on past days

| Concern                                     | Past days                          |
| ------------------------------------------- | ---------------------------------- |
| Incremental tail / seal merge               | No                                 |
| `openThroughNow` live extension             | No (today only)                    |
| Background today sync                       | No                                 |
| Full `prepareDayHistoryTimeline` every open | No                                 |
| `detectTripsForDay` every open              | No (unless rematerialize fallback) |

Today's path (`syncTodayTrips`, `buildTodayDisplayHistory`, incremental materialization) is intentionally different and is **out of scope** for this doc.

---

## Bottom line

**Past days: architecture is sound.** The dominant cost is **read `trips` + `trip_points` + assemble timeline**, which matches benchmark expectations.

**Real annoyances to revisit later:**

1. Flicker + loader on uncached day change.
2. Fingerprint + duplicate `trip_points` read on cache miss.
3. Rare full rematerialize (~benchmark cost).
4. Stale/wrong trips if they were saved wrong while the day was still “today”.

None of these are as severe as today's incremental path. When optimizing, prefer **not breaking the fast stored-read path**.

---

## Possible follow-ups (not decided)

- Keep previous day's map visible while the next day loads (avoid blank overlay).
- Pass `pointsByTripId` from `pastDayCanLoadFromStore` into `loadHistoryFromStoredTrips` (drop duplicate read).
- Soften or skip fingerprint when in-memory cache is warm.
- Preload adjacent day on ←/→ hover (if we add prefetch).
- Nightly or on-version-bump batch reconcile for sealed days (separate from today work).
