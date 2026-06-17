# Location Point Explorer

Standalone internal web app to visualize LifeMap exports. **Not** part of the LifeMap mobile app.

## What it does

- **Detect mode** — load `location_points`, run the same trip algorithm as mobile, plot stays + drives
- **Plot mode** — load pre-built `trips` + `trip_points` from mobile (no re-detection)
- Filter by **source type** with checkboxes (`gps`, `native_queue`, etc.)
- Filter by **date** (America/Chicago calendar day)
- Stops, trips, explain, and benchmark modes

## Run locally

```bash
cd point-explorer
pnpm install
pnpm dev
```

Open http://localhost:5174, choose **Detect** or **Plot**, then load or drop your JSON file.

## Build for static hosting

```bash
pnpm build
pnpm preview
```

Output is in `dist/` — can be opened on any static file host.

## Upload modes

### Detect — `location_points`

Use when you export raw GPS from LifeMap. The explorer runs trip detection, then you click **Identify trips**.

**Location points only** (legacy):

```json
{ "rows": [{ "id": 1, "timestamp": "...", "lat": 33.21, "lng": -97.13, ... }] }
```

**Full database** (Settings → export with `location_points`):

```json
{
  "tables": {
    "location_points": [{ "id": 1, "timestamp": "...", "lat": 33.21, "lng": -97.13, ... }],
    "saved_places": []
  }
}
```

### Plot — `trips` + `trip_points`

Use when you export materialized trips from mobile Settings. Segments plot immediately — no detection step.

```json
{
  "tables": {
    "trips": [
      {
        "id": 1,
        "kind": "stay",
        "dateKey": "2026-06-16",
        "startAt": "...",
        "endAt": "...",
        "segmentOrder": 1,
        "savedPlaceLabel": "Home",
        ...
      }
    ],
    "trip_points": [
      { "tripId": 1, "seq": 0, "lat": 33.21, "lng": -97.13, "recordedAt": "..." }
    ],
    "saved_places": []
  }
}
```

Also accepts explorer trip JSON downloads (`segments` with `path` arrays).
