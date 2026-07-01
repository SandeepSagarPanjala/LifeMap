# Engineering audit tracker

Status key: **todo** | **in progress** | **done** | **later** | **skip**

Coverage (#5) is deferred intentionally.

## Batch 1 — Quick store wins

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3 | Persist `historyEarliestDateKey` | done | Added to Zustand `partialize` |
| 4 | Platform default `preferredMapApp` | done | iOS → apple, Android → google |
| 20 | Gate `devShowOnboarding` with `__DEV__` | done | Setter + omit from persist in prod builds |

## Batch 2 — Schema / DB alignment

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2 | Database indexes in `schema.ts` | done | Mirrors existing SQL migrations; no new migration |

## Batch 3 — Dependency hygiene

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6 | Dependabot | done | `.github/dependabot.yml` — npm weekly + actions monthly |

## Batch 4 — Resilience

| # | Item | Status | Notes |
|---|------|--------|-------|
| 11 | Feature error boundaries (map, capture) | todo | Prevent full-app white screen |

## Batch 5 — Observability

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9 | Sentry spans on slow paths | todo | migrate, trip materialize, backup import |

## Batch 6 — Data safety

| # | Item | Status | Notes |
|---|------|--------|-------|
| 10 | Validate JSON blob columns at repo boundary | todo | `photoAttachmentsJson`, `candidatesJson` |

## Batch 7 — Migrations cleanup

| # | Item | Status | Notes |
|---|------|--------|-------|
| 8 | Consolidate `migrate.ts` helpers | todo | Generic `ensureColumnExists`; defer full Drizzle journal |

## Batch 8 — Tooling

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7 | ESLint v9 + a11y/import plugins | todo | Dedicated PR |
| 16 | CHANGELOG.md | todo | Manual first, automate later |

## Batch 9 — CI / platform

| # | Item | Status | Notes |
|---|------|--------|-------|
| 18 | Android build on PR CI | todo | `mobile-build.yml` exists but manual only |
| 1 | Accessibility labels (incremental) | todo | Start with map + capture controls |

## Later

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5 | Coverage thresholds in CI | later | User requested deferral |

## Skip for now

| # | Item | Status | Notes |
|---|------|--------|-------|
| 12 | Split Zustand by domain | skip | Store still small |
| 13 | AsyncStorage → MMKV | skip | Marginal gain today |
| 14 | Feature flags | skip | TestFlight / small team |
| 15 | Prettier v2 → v3 | skip | Whole-repo format churn |
| 17 | Storybook | skip | Low ROI solo project |
| 19 | App.tsx indentation | skip | Fix when editing file |
