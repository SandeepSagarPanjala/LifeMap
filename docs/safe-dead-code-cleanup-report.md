# Safe Dead Code Cleanup Report

Completed: 2026-06-17. Scope: safe removals only (no behavior-changing refactors).

## Verification summary

| Bucket | Action |
|--------|--------|
| **High-confidence removable** | Deleted (see below) |
| **Needs extra proof** | Kept intentionally (see below) |
| **Do not remove** | Native Swift bridges, active location/place modules |

---

## Deleted files (with evidence)

### App — orphaned screens & navigation

| File | Rationale |
|------|-----------|
| `src/screens/HomeScreen.tsx` | Not registered in `RootNavigator`; no imports |
| `src/screens/TimelineScreen.tsx` | Not registered in `RootNavigator`; no imports |
| `src/screens/PrivacyOnboardingScreen.tsx` | Replaced by `OnboardingScreen` in `App.tsx` |
| `src/screens/DayDetailScreen.tsx` | Only navigated from deleted Home/Timeline screens |
| `src/components/timeline/DaySummaryCard.tsx` | Only used by deleted Home/Timeline screens |

**Navigation updates:** Removed `DayDetail` route from `RootNavigator` and `navigation/types.ts`.

### App — unused map components & hooks

| File | Rationale |
|------|-----------|
| `src/components/map/DayPickerStrip.tsx` | Zero inbound imports |
| `src/components/map/MaterializationActivityDot.tsx` | Zero inbound imports |
| `src/components/map/TravelMomentCallouts.tsx` | Zero inbound imports |
| `src/components/map/VisitInAreaPaths.tsx` | Zero inbound imports |
| `src/hooks/use-date-keys-for-month.ts` | Zero inbound imports |
| `src/hooks/use-date-keys-with-data.ts` | Zero inbound imports |
| `src/hooks/use-day-summaries.ts` | Duplicate of `use-location-days`; zero imports |
| `src/hooks/use-today-moments.ts` | Zero inbound imports |
| `src/hooks/use-location-days.ts` | Only consumed by deleted screens |

### App — unused repositories & libs

| File | Rationale |
|------|-----------|
| `src/db/repositories/materialization-queue.ts` | Repo never imported; table still exported via schema in `database-export.ts` |
| `src/db/repositories/history.ts` | Only called from deleted `PrivacyOnboardingScreen` |
| `src/lib/constants.ts` | Zero TS imports (device UDID lives in `scripts/run-ios-device.sh`) |
| `src/lib/location-export.ts` | Test-only |
| `src/lib/location-gap-analysis.ts` | Test-only |
| `src/lib/trip-route-simplify.ts` | Test-only; `simplifyDriveRoute` unused in `src/` |

**Related test removals:** `__tests__/location-export.test.ts`, `__tests__/location-gap-analysis.test.ts`; `simplifyDriveRoute` / `pointToSegmentDistanceMeters` cases removed from `__tests__/trip-geometry.test.ts`.

### App — trimmed symbols (not whole files)

| Location | Removed |
|----------|---------|
| `src/db/repositories/location-days.ts` | `DaySummary`, `getDaySummaries`, `getHomeLocationData`, `getHistoricalOnThisDaySummaries`, `getDateKeysWithLocationDataInRange`, `getAllLocationPoints` |
| `src/db/repositories/trips.ts` | `setTripSelectedCandidateIndex`, `countAllTrips` |
| `src/db/repositories/storage-stats.ts` | `DatabaseStorageStats`, `getDatabaseStorageStats` |
| `src/components/theme/theme-provider.tsx` | `useAccentThemeId` |
| `src/location/native-location-persist.ts` | `stopNativeLocationTracking` |
| `src/lib/place-lookup-native.ts` | `isPlaceLookupNativeAvailable` |

### Point Explorer — dead code

| Location | Change |
|----------|--------|
| `point-explorer/src/lib/export.ts` | Removed `dateKeyForDate`, `inferDefaultUploadMode` |
| `point-explorer/src/lib/point-nav.ts` | Removed `sortPointsById` |
| `point-explorer/src/lib/saved-places.ts` | Removed `driveSavedPlaceLabel` |
| `point-explorer/src/lib/explain.ts` | Removed unreachable `missing` branch in `explainPoint`; removed `explainStopDetection` |
| `point-explorer/src/lib/stored-trips.ts` | Removed unused type imports |

---

## Kept intentionally (medium/high risk)

| Item | Reason |
|------|--------|
| `ios/LifeMap/LifeMapDatabase.swift` | Active native persist path (`LocationPersistModule`, `LocationWakeCoordinator`) |
| `ios/LifeMap/LocationWakeCoordinator.swift` | Started from `AppDelegate`, geofence/stale recovery |
| `src/location/native-location-persist.ts` (remainder) | Used by `bootstrap.ts`, `location-persist-pipeline.ts`, `geofence-registry.ts` |
| `src/lib/place-lookup-native.ts` (remainder) | Used by `place-lookup-service.ts` |
| `materialization_queue` **table** | Still exported in full DB export; only unused **repository module** was removed |
| `getDateKeysWithLocationData()` | Still used by `trip-materialization.ts` (deprecated but live) |
| ObjC bridge methods (`stopNativeTracking`, etc.) | RN dynamic linking; TS wrapper removed but native method kept |

---

## Verification gates run

- `pnpm build` in `point-explorer/` — pass
- `pnpm test __tests__/trip-geometry.test.ts` — pass
- `pnpm test __tests__/database-export.test.ts __tests__/trip-materialization.test.ts __tests__/explorer-trip-points.test.ts` — pass
- `rg` re-check: no remaining imports of deleted modules

---

## Optimization backlog (list only — not implemented)

Prioritized follow-ups discovered during cleanup. Tags: **Impact** (H/M/L), **Risk** (H/M/L), **Effort** (S/M/L).

### High impact, low risk

| # | Item | Targets | I | R | E |
|---|------|---------|---|---|---|
| 1 | Replace full-table `getDateKeysWithLocationData()` in trip materialization with range-scoped queries | `src/lib/trip-materialization.ts`, `src/db/repositories/location-days.ts` | H | L | M |
| 2 | Wire calendar dots to `getDateKeysWithLocationDataInRange` (re-add as needed) instead of deprecated full scan | `HistoryDatePickerSheet.tsx`, new thin hook | H | L | S |
| 3 | Remove stale `history_start_at` setting key from existing installs (one-time migration) | `src/db/migrate.ts` | L | L | S |

### Medium impact

| # | Item | Targets | I | R | E |
|---|------|---------|---|---|---|
| 4 | Consolidate trip label update paths (`updateTripLabelSelection` vs removed `setTripSelectedCandidateIndex`) | `src/db/repositories/trips.ts` | M | L | S |
| 5 | Drop empty `src/components/timeline/` directory after git commit | filesystem | L | L | S |
| 6 | Update README device UDID note (`constants.ts` deleted; use env in `scripts/run-ios-device.sh`) | `README.md` | L | L | S |
| 7 | Point-explorer: add `.point-nav-sub` CSS (class used in `App.tsx`, missing from `App.css`) | `point-explorer/src/App.css` | L | L | S |

### Higher effort / architectural

| # | Item | Targets | I | R | E |
|---|------|---------|---|---|---|
| 8 | Reconnect or permanently drop `DayDetail` day drill-down (map-first UX may supersede) | navigation, map screen | M | M | M |
| 9 | Materialization queue: either wire job processor or drop table from schema + export | `schema.ts`, `database-export.ts` | M | H | L |
| 10 | Fix pre-existing `tsc` errors in tests and segmentation modules (unrelated to this pass) | `__tests__/`, `src/lib/segmentation/` | M | M | L |
| 11 | Route simplification: reintroduce only if map rendering needs Douglas–Peucker on live paths | map layer code | M | M | M |

### Native (defer unless profiling proves dead code)

| # | Item | Targets | I | R | E |
|---|------|---------|---|---|---|
| 12 | Audit `stopNativeTracking` bridge — TS caller removed; keep until lifecycle audit | `LocationPersistModule.swift` | L | H | M |
| 13 | Document native persist vs TransistorSoft dual-path for onboarding | `src/location/` docs | M | L | S |

---

## Notes

- Onboarding flow unchanged: `OnboardingScreen` + `hasCompletedPrivacyOnboarding` in app store.
- No runtime behavior changes intended for map, settings, tracking, or export flows.
- `demo_denton` test data was not touched in this pass.
