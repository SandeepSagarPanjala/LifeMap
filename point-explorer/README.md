# Location Point Explorer

Standalone internal web app to visualize LifeMap `location_points` JSON exports. **Not** part of the LifeMap mobile app.

## What it does

- Load LifeMap JSON exports: location-points (`rows`) or full database (`tables.location_points`)
- Filter by **source type** with checkboxes (`gps`, `native_queue`, `motion_departure`, `native_queue:motionchange`, plus any others in the file)
- Click **Plot** to draw only the selected sources on the map (blue dots, chronological blue path)
- Filter by **date** (America/Chicago calendar day)
- Click a point for id, time, coordinates, accuracy, source

## Run locally

```bash
cd point-explorer
pnpm install
pnpm dev
```

Open http://localhost:5174 and use **Load JSON export** or drag-and-drop your file.

## Build for static hosting

```bash
pnpm build
pnpm preview
```

Output is in `dist/` — can be opened on any static file host.

## Export format

Accepts either LifeMap export shape:

**Location points only** (legacy):

```json
{ "rows": [{ "id": 1, "timestamp": "...", "lat": 33.21, "lng": -97.13, ... }] }
```

**Full database** (Settings → All tables):

```json
{
  "tables": {
    "location_points": [{ "id": 1, "timestamp": "...", "lat": 33.21, "lng": -97.13, ... }]
  }
}
```
