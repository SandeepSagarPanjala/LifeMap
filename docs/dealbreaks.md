# Dealbreaks

Hard constraints. Changing these without understanding the dependency **breaks the app** — wrong today timeline, missing cross-midnight drives, or silent data loss.

Before refactoring bootstrap, today sync, sealing, or background work: **read this file**.

When you discover a new dealbreak, **add it here** before merging.

---

## 1. `sealYesterdayIfNeeded` before today build

**Do not** move yesterday sealing after today’s map preload / foreground refresh.

### Why

Today’s live/tail detection depends on yesterday being sealed first.

When today has no sealed trips yet, `loadYesterdayLookbackPointsForToday` reads `excludedCrossMidnightFromMs` from yesterday’s `materialized_days` row and pulls late-night GPS into today’s detect. That field is only written when yesterday is sealed (`splitEntriesForPastDaySeal` → `materializePastDayFromGps`).

If yesterday is sealed later (e.g. only in the background-work coordinator after the map paints), the first today build can:

- Miss or split a **cross-midnight drive**
- Show a wrong tail / empty lookback
- Cache a bad today timeline until something forces a rebuild

### Required order

| Path | Order |
| ---- | ----- |
| Cold start | `sealYesterdayIfNeeded()` → `preloadTodayHistory()` |
| BG → FG | `sealYesterdayIfNeeded()` → `refreshTodayOnForeground()` |
| Background work | Yesterday is **not** sealed here — only AppBootstrap. Banner backlog is days **older than yesterday** (`date_key < yesterday`) |

### Code anchors

- `src/components/AppBootstrap.tsx` — critical-path calls
- `src/lib/trip-materialization.ts` — `sealYesterdayIfNeeded`
- `src/lib/today-lookback.ts` — lookback from `excludedCrossMidnightFromMs`
- `src/lib/today-live-history.ts` — today display / tail uses lookback
- `src/db/repositories/location-day-summaries.ts` — past-day banner backlog excludes yesterday

### Safe vs unsafe

| Safe | Unsafe |
| ---- | ------ |
| Keep yesterday seal on the critical path (silent, no banner) | Defer yesterday seal until after map preload / FG refresh |
| Seal older past days in the coordinator with a banner | Treat yesterday like any other past day in the banner queue |
| Call `sealYesterdayIfNeeded` again later as a no-op / fallback | Assume “coordinator will seal yesterday eventually” is good enough for first paint |

---

## How to add a dealbreak

1. **Title** — what must not change
2. **Why** — what breaks if you ignore it
3. **Required order / invariant** — the rule in one table or sentence
4. **Code anchors** — files / functions to check
5. **Safe vs unsafe** — concrete do / don’t

Keep entries short. Link to deeper docs (`cold-start-flow.md`, `timeline-model.md`, etc.) when needed.
