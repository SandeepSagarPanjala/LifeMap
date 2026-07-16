# Existing-user / upgrade-only code

LifeMap is still pre-production. We are **not** optimizing for upgrading old installs — wipe/reinstall as a new user is fine.

This doc lists code that exists mainly for **legacy data**, **mid-flight schema upgrades**, or **repairing already-filled DBs**. Clean up later when we want a new-user-only codebase.

**Do not confuse with:** place-lookup / place-cache “backfill” of unlabeled stays — that is normal product work for any user with unlabeled trips, not an upgrade path.

---

## Explicit legacy / existing-data paths

| Location | What it does |
| -------- | ------------ |
| `src/components/settings/cached-places-settings.tsx` | Settings UI: **“Legacy POI data”** — migrate old storage into `place_pois` |
| `src/db/migrate-place-pois-data.ts` | `countLegacyPlaceLookupCandidatesPending`, `migrateLegacyPlaceLookupCandidatesToPois` |
| `src/db/repositories/place-lookup-cache.ts` | `listLegacyPlaceLookupCacheRows`, `clearLegacyCandidatesJson` |
| `src/db/schema.ts` (`place_lookup_cache`) | `candidatesJson` / `selectedCandidateIndex` kept for one-time POI migration |
| `src/lib/trip-materialization.ts` | `purgeLegacyMotionLocationData()` — delete old motion GPS rows + rebuild trips |
| `src/db/repositories/location-points.ts` | Treats legacy `motion` / `headless:motion` sources specially |
| `src/lib/saved-place-address.ts` | `backfillMissingSavedPlaceAddresses()` — fill addresses on old saved places |
| `src/lib/backup/native-backup-cloud.ts` | Reads/cleans legacy Android backup slots (`current` / `previous`) |
| `src/db/location-points-dedupe.ts` | Dedupe helpers + unique-index repair for existing point tables |
| `src/db/migrate.ts` → `repairLocationPointsDedupeUniqueIndex` | Bootstrap repair when unique index can’t be created yet |

---

## Schema `ensure*` helpers (upgrade-safe bootstrap)

Called from `src/db/client.ts` after migrations. Fresh installs usually already have these columns from journal migrations; these helpers mainly patch **DBs that upgraded mid-development**.

| Helper | File |
| ------ | ---- |
| `ensureTripSegmentMetadataColumns` | `src/db/migrate.ts` |
| `ensureTripPointMetadataColumns` | `src/db/migrate.ts` |
| `ensureMomentsMoodColumns` | `src/db/migrate.ts` |
| `ensureMomentsWithoutLocationColumns` / `rebuildMomentsTableWithoutLocationColumns` | `src/db/migrate.ts` |
| `ensureMaterializedDayGeometryColumn` | `src/db/migrate.ts` |
| `ensureMaterializedDayExcludedDriveColumn` | `src/db/migrate.ts` |
| `repairLocationPointsDedupeUniqueIndex` | `src/db/migrate.ts` |

---

## Not existing-user-only (keep)

| Location | Why it’s normal product |
| -------- | ----------------------- |
| `src/lib/place-lookup-backfill.ts` | Label unlabeled sealed stays (any user) |
| `src/lib/place-lookup-catch-up.ts` | Older catch-up runner for same idea |
| `src/lib/place-cache-work.ts` / `place-cache-backlog.ts` | Foreground place-cache phase for unlabeled stays / open visit |
| `location_day_summaries` insert-once via `Set` | Day index for past-seal backlog; grows with new GPS |

---

## Already removed (background-work PR)

- Upgrade backfill of `location_day_summaries` from all GPS points
- Dev “Rebuild location day index”
- Wipe-5-days / banner preview / Sentry crash-test controls

---

## Cleanup checklist (later)

- [ ] Remove Legacy POI Settings UI + `migrate-place-pois-data` + legacy cache helpers; drop deprecated `candidatesJson` columns when safe
- [ ] Remove or gate `purgeLegacyMotionLocationData` and motion-source special cases if motion rows are gone
- [ ] Remove `backfillMissingSavedPlaceAddresses` if all saved places always get addresses on create
- [ ] Simplify Android backup to current slot layout only (drop legacy slot cleanup)
- [ ] Revisit GPS dedupe repair on every bootstrap vs new-install-only unique index
- [ ] Audit `ensure*` column helpers — keep only what migrations don’t already guarantee for greenfield installs
- [ ] Strip leftover “upgrade backfill” comments in `background-work-coordinator.ts`
