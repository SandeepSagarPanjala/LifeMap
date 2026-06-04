# Location Point Explorer

Standalone internal web app to visualize LifeMap `location_points` JSON exports. **Not** part of the LifeMap mobile app.

## What it does

- Load `all data.json` (or any export with a `rows` array)
- Plot every save on an OpenStreetMap map (blue dots, chronological blue path)
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

Expects the same shape as LifeMap exports:

```json
{
  "rows": [
    {
      "id": 1,
      "timestamp": "2026-06-04T09:00:00.000Z",
      "lat": 33.21,
      "lng": -97.13,
      "accuracy": 8,
      "altitude": null,
      "speed": null,
      "source": "gps"
    }
  ]
}
```
