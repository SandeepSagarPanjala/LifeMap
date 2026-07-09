# How LifeMap saves location (today)

## Pipeline

1. **Transistorsoft Background Geolocation SDK** runs with the preset from Settings (distance + save cap).
2. Each GPS fix arrives on `onLocation`. **`onMotionChange`** forces a save when you start or stop moving (arrival / departure). **`onHeartbeat`** (every 60s) requests a fresh GPS fix if nothing was saved for **30 minutes** while still.
3. **`persistLocation`** decides whether to write to SQLite now or schedule a later write (sparse when stationary, denser when moving).
4. **`insertLocationPoint`** stores: `timestamp`, `lat`, `lng`, `accuracy`, `altitude`, `speed`, `source` (`gps`, `motion`, `heartbeat_ping`).

## Preset labels (two numbers)

| Part                  | Meaning                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| **25 m**              | SDK `distanceFilter` — when the OS/plugin may emit an update while moving |
| **max 1 save / 30 s** | App cap — at most one row per 30s window (latest fix in that window wins) |

**Important:** The save cap is not “every 25 m.” A fast drive can move hundreds of meters in 30s while only one row is saved → straight lines on the map.

## Extra rule (added for driving)

With a time cap preset, LifeMap also saves **immediately** when you have moved **≥ preset distance** since the **last saved** point (e.g. 25 m), then starts a new 30s window.

## Presets without a time cap (`25 m · distance only`)

Saves when you move ≥ preset distance or on motion start/stop. Still sparse when stationary; heartbeat still runs the 30 min stationary ping.

## What we do _not_ save today

- Interpolated points between saves
- Activity type (walking/driving)
- Places / geofence names

Trips are built **only from saved rows**. Gaps in the DB (e.g. 4:34–4:49 with no points) appear as **Gap** cards in the timeline.

## Inspecting / exporting rows

The file `lifemap.db` is **encrypted** (SQLCipher + key in Keychain), so desktop SQLite browsers cannot open it directly.

In the app: **Settings → Export location data**

- **Today** or **All saved data**, as **JSON** or **CSV**
- Raw `location_points` columns: `id`, `timestamp` (ISO), `lat`, `lng`, `accuracy`, `altitude`, `speed`, `source`
- Share via the system sheet (AirDrop, Files, Mail, Notes, etc.)

## Why 19 minutes with “no location saved” is possible

| Cause               | What happens                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Save cap**        | Only one row per 30 s while moving; if SDK did not fire, nothing saved             |
| **Stationary**      | Very few saves when not moving 25 m                                                |
| **Tracking off**    | Toggle off or OS killed background work                                            |
| **GPS / tunnel**    | No fix → no row                                                                    |
| **Preset gap rule** | Trip detection uses 10 min between _points_; export gaps use 2 min between _saves_ |

A 19 min gap means: last row at T₁, next row at T₂, and **T₂ − T₁ = 19 min** — not that the app “lost” data it had, but that **nothing was written** in between.
