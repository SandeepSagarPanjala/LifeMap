# @lifemap/segmentation

Single source of truth for LifeMap **stay/drive detection** — shared by:

- **iOS app** — `src/lib/segmentation/` (thin adapter → timeline + SQLite)
- **Point Explorer** — `point-explorer/` (batch detect on JSON export)

## Contents

Core algorithm (no React Native / SQLite):

- `detectTrips` / `detectTripsForDay` — stop detection, segment build, reconcile, annotate
- `annotateSegments` — saved places + optional `place_lookup_cache` labels
- `stay-geometry` / `travel-geometry` — canonical path export
- `day-bounds` — America/Chicago calendar days

## Usage

```typescript
import {
  detectTripsForDay,
  rawRowsToParsedPoints,
  type ParsedPoint,
} from '@lifemap/segmentation';

const parsed = rawRowsToParsedPoints(locationRows);
const { segments } = detectTripsForDay(
  dayKey,
  parsed,
  stopConfig,
  savedPlaces,
  placeLookupCache,
);
```

Mobile app code should prefer `@/lib/segmentation` (`buildSegmentationTimeline`) for timeline types and DB adapters.

## Development

```bash
pnpm --filter @lifemap/segmentation typecheck
pnpm test __tests__/segmentation-detection.test.ts
```

When changing detection logic, edit **only** this package — do not fork copies under `point-explorer/src/lib/`.
