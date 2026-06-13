# Tracking reliability plan

Backlog from Jun 2026 dogfood — Motion-only wake-up misses drives (pocket + EV, Life360 captured same trips).

## Goal

Any one signal should wake tracking — not Motion alone.

```
Motion moving?       → MOVING
GPS speed high?      → MOVING
GPS drift ≥ 100m?    → MOVING
Left home geofence?  → MOVING
Heartbeat fresh GPS? → MOVING
```

## Recommended Transistor presets

### Geo + spacing (default profile)

| Setting | Value | Why |
|---------|-------|-----|
| `distanceFilter` | **10m** (was 25m) | Better walks + short trips; elasticity widens at speed |
| `disableElasticity` | **false** | Auto: slow → tighter points, fast → wider |
| `elasticityMultiplier` | **1.0** | SDK default formula |
| `desiredAccuracy` | **High** | Real GPS for routes |
| `stopTimeout` | **5 min** | Avoid false stop at red lights |
| `stopDetectionDelay` (iOS) | **60–90 sec** | Grace before GPS sleeps |

### Activity / Motion sensitivity

```javascript
activity: {
  minimumActivityRecognitionConfidence: 55,  // default 70 iOS / 75 Android — slightly more sensitive
  activityRecognitionInterval: 5000,           // Android only: poll every 5s (default 10s)
  motionTriggerDelay: 0,                     // Android only: don't cancel brief walks
}
```

Notes:
- Lower confidence helps when Motion reports `walking` at 55–65% (below default cutoff).
- Does **not** help when Motion reports `still` at 90% (EV + pocket case) — need GPS/geofence wake-ups.
- Do **not** go below ~50 without testing — too many false wakes at home.

### Maximum reliability — **ON by default**

**Decision:** Ship with Maximum reliability **switched on** for all users. GPS stays active when still; saves every ~`distanceFilter` (10m) while moving. Motion is no longer the gatekeeper for wake-up. Users can turn off in Settings if battery is a concern (~10–15%/day).

```javascript
activity: { disableStopDetection: true },
geolocation: { pausesLocationUpdatesAutomatically: false },
app: { preventSuspend: true, heartbeatInterval: 60 },  // iOS: battery cost
```

Persist via `SETTINGS_KEY_TRACKING_MAX_RELIABILITY` — default **`true`** for new and existing installs when we apply this pass.

Settings UI: wire the existing “Maximum reliability” switch (currently disabled placeholder) — **on by default**, user can disable for balanced/battery-friendly mode.

### Departure watchdog & speed wake (tune static thresholds)

| Constant | Today | Target | Why |
|----------|-------|--------|-----|
| `MIN_DEPARTURE_SPEED_MS` / GPS speed wake | 2 m/s (~7 km/h) | **4.5 m/s (~10 mph)** | Fast-walk false positives at 2 m/s; drives clear at 10 mph |
| `DEPARTURE_WATCHDOG_MIN_MS` | 15 min | **5 min** | Shorter wait before speed-based departure check |
| `HEARTBEAT_DEPARTURE_DISTANCE_METERS` | 100 m | **100 m** | Keep |
| `STATIONARY_PING_MIN_MS` | 30 min | **30 min** | Keep |
| `HEARTBEAT_CHECK_INTERVAL_SEC` | 60 s | **60 s** | Platform minimum — keep |

### Place & timeline radius — **20 m**

**Decision:** Use **20 m** for both saved places and history same-place detection (was 150 m saved places, 25 m history).

| Setting | Today | Target | Code / schema |
|---------|-------|--------|---------------|
| Saved place radius (Home, Work, etc.) | **150 m** | **20 m** | `DEFAULT_SAVED_PLACE_RADIUS_METERS`, `saved_places.radius_meters` default, UI copy |
| `HISTORY_SAME_PLACE_RADIUS_METERS` | **25 m** | **20 m** | `src/lib/trip-settings.ts` |
| Home geofence exit (departure wake) | (planned 150 m) | **20 m** | `addGeofence` around saved Home at place radius |

Notes:
- Tighter than typical life apps (often 50–150 m) — matches precise “this spot” semantics.
- GPS jitter is often 5–10 m; 20 m may false-trigger geofence exit or split visits — validate on dogfood.
- `TRIP_RADIUS_CHOICES` in Settings may need **20** added if users can pick radius.
- **Not the same as visit envelope** — see Visit vs drive classification below. Mall visits use a **larger spread envelope** (path vs anchor); 20 m is for saved-place label / geofence / merge same pin.

## Visit vs drive classification (product model)

LifeMap should classify movement using **time + distance + speed + spread** — not coordinates alone.

### Target mental model

**Authoritative rules:** [`timeline-model.md`](./timeline-model.md) — alternating drive/visit, speed classification, time continuity.

| Mode | Speed | Distance / spread | Time | Example |
|------|-------|-------------------|------|---------|
| **Still** | ≤ ~2 m/s (or null) | Tiny spread from anchor | Any | Sitting on couch, parked |
| **Walking / venue visit** | Low–moderate (~0–6 km/h) | **High path**, **bounded spread** (mall, campus) | ≥ dwell (5 min) or mid-route stop | Walking entire mall — lots of steps, stay inside venue envelope |
| **Drive** | Moderate–high (≥ ~10 mph typical) | **Large path distance**, leaves area | Continuous movement between stays | Sister drop-off, highway |

**Mall rule:** User can walk 500 m+ inside a mall but still be **one visit** — classify by **spread from arrival anchor** + **path÷spread ratio** (looping walk), not by “moved 500 m therefore driving.”

**Drive rule:** Must show **meaningful distance** (path) and **drive-like implied speed** between places — not just GPS jitter at home.

### How code works today (`src/lib/trip-detection.ts`)

| Signal | Constant / logic | Used for |
|--------|------------------|----------|
| Stationary save | `VISIT_ARRIVAL_SPEED_MS` = **2 m/s** | Visit start/end boundaries (`isStationarySave`) |
| Visit envelope | `MAX_STAY_ENVELOPE_SPREAD_M` = **250 m** | Stay span — points within spread of anchor |
| Mall / campus walk | `VENUE_MAX_SPREAD_M` = **400 m**, `isVenueWalkCluster` | Peel mall walking from end of drive; path÷spread ≥ 2 |
| Meaningful drive | `MIN_TRAVEL_DISTANCE_M` = **40 m**, or **≥ 100 m** | `isMeaningfulTravel` |
| Departure hop | implied speed **2.5–80 km/h**, 80–800 m in ≤ 5 min | `isShortGapDeparture` — left visit, not GPS wake |
| Stale wake (still at place) | gap ≥ 10 min, drift &lt; 400 m, speed &lt; 2 km/h | `isStaleWakeNotDeparture` |
| Dwell for visit | `DEFAULT_TRIP_DWELL_MINUTES` = **5 min** | Min time for stay card |
| Same-place merge | `dwellRadiusMeters` / `HISTORY_SAME_PLACE_RADIUS` (**→ 20 m**) | Merge adjacent visits at same pin |
| Saved Home label | saved place radius (**→ 20 m**) | “Home” card, geofence |

**Verified:** Mall-style visits are **already partially implemented** via spread envelope + venue walk clustering — not just 20 m radius.

### Gaps vs target model (align in implementation)

1. **Drive should require speed evidence** — today `isMeaningfulTravel` is mostly **distance-only** (40–100 m). Add implied-speed check for travel legs (align with **10 mph** tracking wake).
2. **Still vs walking** — uses GPS `point.speed` when present; many saves have `speed: null` → falls back to spread/time only. More saves with max reliability + better GPS should improve this.
3. **20 m vs mall envelope** — **20 m** applies to saved-place pin + geofence + merge; **visit detection** must keep **separate larger envelope** (250–400 m spread) so mall walk stays one visit. Do not collapse mall logic to 20 m.
4. **Revisit constants after 20 m change** — `MAX_STAY_ENVELOPE_SPREAD_M` / `VENUE_MAX_SPREAD_M` may need retuning with tighter pin radius; document in dogfood.

### Classification flow (target)

```
Saved points (time-ordered)
    ↓
Dedupe same timestamp/coords
    ↓
Find stay spans: spread ≤ envelope + dwell time
    ↓
Between stays → travel slices
    ↓
isMeaningfulTravel? distance + (add) implied speed
    ↓
Venue peel: mall walk at end of drive → stay not travel
    ↓
Merge same-area stays (20 m pin radius)
    ↓
Visit boundaries: speed ≤ 2 m/s for arrival/departure parked saves
    ↓
Timeline: Stay | Drive | Gap cards
```

## Transistor SDK integration (learned from docs)

LifeMap is on `react-native-background-geolocation` **v5.1.1**. Goal: use the SDK as designed — compound config, full event surface, correct lifecycle — not just “make flat keys work.”

Doc index: [Setup](https://docs.transistorsoft.com/react-native/setup/) · [Examples](https://docs.transistorsoft.com/react-native/examples/) · [BackgroundGeolocation](https://docs.transistorsoft.com/react-native/BackgroundGeolocation/) · [Config](https://docs.transistorsoft.com/react-native/Config/) · [CurrentPositionRequest](https://docs.transistorsoft.com/react-native/CurrentPositionRequest/) · [Migration guide](https://github.com/transistorsoft/react-native-background-geolocation/blob/master/help/MIGRATION-GUIDE-5.0.0.md)

### Lifecycle (stereo receiver model)

| Step | API | LifeMap |
|------|-----|---------|
| Wire speakers | Register `onX` listeners **before** `ready()` | ✅ `configure()` |
| Plug in power | `ready(config)` **once per launch** — without it SDK is silent | ✅ |
| Power button | `start()` / `stop()` — tracking on/off | ✅ `syncEnabledFromSettings()` respects user setting |

Rules from docs:
- Do **not** call `start`, `requestPermission`, `getCurrentPosition`, `watchPosition` until **after** `ready()` resolves.
- `ready()` restores persisted state; if tracking was on at kill, SDK may auto-resume — LifeMap still gates on `tracking_enabled` (correct product behavior).
- `registerHeadlessTask` must live in **`index.js`** (not a component); callback must be **`async`** and **await** all work.

### What `start()` actually does (root cause of Jun 11)

> `start()` puts SDK in **STATIONARY**: one GPS fix, then **GPS off until Motion wakes it**.

Long home stay + pocket + smooth EV → Motion stays `still` → zero points until app opens. Our wake-up plan (`changePace`, speed, geofence, heartbeat + fresh GPS) maps directly to documented APIs.

### iOS force-quit vs background

| State | Behavior |
|-------|----------|
| Background (not killed) | JS alive; listeners + heartbeat work (with `preventSuspend`) |
| Force-quit (swipe up) | JS dead; iOS creates stationary geofence (~`stationaryRadius`, often ~200 m); app relaunches on exit |
| Android terminated | Native service continues; custom JS work needs `app.enableHeadless: true` + headless task |

### Heartbeat contract

- `onHeartbeat` delivers **last-known** location only — does **not** turn GPS on.
- Inside heartbeat: call `getCurrentPosition(...)` — see **CurrentPositionRequest** below.
- iOS: requires `app.preventSuspend: true` + `app.heartbeatInterval` (default 60s when enabled). Unplugged + screen off → iOS may throttle heartbeats ~2 min (doc warning).
- Android: heartbeat disabled by default (`-1`); minimum interval **60s**.

### `getCurrentPosition` ([CurrentPositionRequest](https://docs.transistorsoft.com/react-native/CurrentPositionRequest/))

Options for one-shot high-power GPS inside heartbeat, geofence EXIT handler, and Android headless. Centralize as **`HEARTBEAT_CURRENT_POSITION_REQUEST`** in `src/lib/motion-tracking-policy.ts` (reuse in headless).

| Option | Default (SDK) | LifeMap today | Target | Why |
|--------|---------------|---------------|--------|-----|
| `maximumAge` | **0** (fresh only) | omitted (inherits 0) | **`0` explicit** | Reject cached home coords; Jun 11 watchdog saw `distanceMeters: 0` while user was driving |
| `samples` | **3** | **1** ✅ | **1** | Heartbeat must finish quickly (~60s window); one sample enough for departure speed/drift |
| `persist` | `true` when enabled | **`false`** ✅ | **`false`** | LifeMap writes to our SQLite; avoid duplicate SDK queue + `onLocation` |
| `timeout` | **30** s | **30** ✅ | **30** | Rejects with `LocationError` → log `heartbeat_error` (already) |
| `desiredAccuracy` | `stationaryRadius` (~150 m) | **omitted** | **`25` m** | **Stopping threshold** (not hardware) — stop sampling once accuracy ≤ 25 m; aligns with `MAX_DEPARTURE_ACCURACY_METERS` gate |
| `extras` | — | omitted | optional `{ source: 'heartbeat' }` | Debug in SDK logs if needed |

Notes from docs:
- SDK **always** requests native GPS at `DesiredAccuracy.High` regardless of `desiredAccuracy` option — the option only controls when to **stop sampling** and return.
- Only the **final** selected sample is persisted (when `persist: true`); intermediate samples still fire `onLocation` with `sample: true` → filter in `onLocation`.
- Call only **after** `ready()` resolves (and tracking enabled for meaningful departure checks).
- Reuse same options in headless `Heartbeat` case (Android terminated).

```typescript
// Target — motion-tracking-policy.ts
export const HEARTBEAT_CURRENT_POSITION_REQUEST = {
  timeout: 30,
  maximumAge: 0,
  desiredAccuracy: 25,
  samples: 1,
  persist: false,
} as const;
```

After `getCurrentPosition`, still run `evaluateDepartureWatchdog` accuracy gate (`accuracy > 75 m` → ignore speed-based departure).

### `changePace(true)`

Manually forces **MOVING** — bypasses motion sensors, GPS on immediately. Use for: departure watchdog, GPS speed wake, geofence EXIT. Do not call `changePace(false)` from app logic unless user stops tracking.

### `onLocation` — filter sample fixes

During `getCurrentPosition` / `onMotionChange`, intermediate fixes arrive with `location.sample === true`. They are **not** persisted by SDK but **do** hit `onLocation`. LifeMap must skip them before writing to SQLite (avoids jitter duplicates).

### Native queue pattern (already in use)

SDK persists to its own SQLite when JS is slow/dead. On configure/start, drain via `getLocations()` → import to LifeMap DB → `destroyLocations()`. Keep this after every `start()` and in heartbeat.

### v5 `LocationFilter` (review during migration)

v5 adds on-device `geolocation.filter` (enabled by default). Can change which fixes reach `onLocation` and distance smoothing. Read [LocationFilter](https://docs.transistorsoft.com/react-native/LocationFilter/) before tuning — do not fight the filter unknowingly.

### `Config.reset` (development)

`reset` defaults to **`true`**: every `ready()` merges config on factory defaults. Leave unset during this pass so code changes apply each launch. Only set `reset: false` in production once config is stable (otherwise `ready()` config is ignored after first install).

### Release builds & license

- **Debug** (`pnpm ios`): full SDK, no license — use for reliability dogfood.
- **Release** / TestFlight (`pnpm ios:beta`): v5 **JWT** license required in `Info.plist` (`TSLocationManagerLicense`). Unlicensed Release may have broken/limited background GPS.
- Trial: email info@transistorsoft.com (bundle `com.sunrio.lifemap`, SDK v5.1.1). No published SLA; expect a few business days.

---

## SDK v5 compound config migration

**Do we need to migrate?** **Yes — required for this pass.**

Flat config still runs on v5.1.1 (deprecation warnings) but:
- Official [Config](https://docs.transistorsoft.com/react-native/Config/) / [Examples](https://docs.transistorsoft.com/react-native/examples/) use nested groups only.
- Keys moved groups — see mapping table below.
- **Maximum reliability** toggle must use grouped `setConfig()` — flat spread is fragile.
- New features (`geolocation.filter`, typed `Config`) need compound structure.
- Use SDK types: `import type { Config } from 'react-native-background-geolocation'`.

### Code today vs target (config drift)

| Key | Code today | Target | Group |
|-----|------------|--------|-------|
| `distanceFilter` | **25** | **10** | `geolocation` |
| `stopTimeout` | **30** min | **5** min | `geolocation` |
| `stopDetectionDelay` | **5** min | **60–90** s | `activity` |
| `locationAuthorizationRequest` | top-level flat | **`Always`** | `geolocation` |
| `enableHeadless` | **missing** | **`true`** | `app` (Android) |
| `debug` / `logLevel` | top-level flat | nested | `logger` |
| `autoSync` / `batchSync` | top-level flat | nested | `http` |
| `maxRecordsToPersist` | top-level flat | nested | `persistence` |

### Alignment with Transistor setup patterns

| Pattern | LifeMap today | Verdict |
|---------|---------------|---------|
| Listeners before `ready()` | ✅ `onLocation`, `onMotionChange`, `onHeartbeat`, `onProviderChange`, `onAuthorization` | Good |
| `ready()` ≠ tracking on | ✅ bootstrap → configure → permission → syncEnabledFromSettings → `start()` | Good |
| `stopOnTerminate: false` | ✅ | Matches plan |
| `startOnBoot: true` | ✅ | Matches plan |
| `distanceFilter: 10` | ❌ still **25** | Change |
| v5 nested config | ❌ flat spread | **Migrate** |
| `enableHeadless` | ❌ missing | **Add** |
| Filter `location.sample` | ❌ saves all `onLocation` | **Add** |
| `getCurrentPosition` options | partial (`samples`, `persist`, `timeout`) | **Add `maximumAge: 0`, `desiredAccuracy: 25`** |
| `onGeofence` + `addGeofence` | ❌ not wired | Plan #5 |
| Headless beyond `Location` | ❌ only `Event.Location` | Plan #10 |
| `onActivityChange` logging | ❌ | Phase 2 |

### Target shape (`tracking-presets.ts` + `transistorsoft-location-service.ts`)

Implement **`getTrackingConfig(maxReliability: boolean): Config`** returning compound config. **`applyTrackingProfile(enabled, maxReliability)`** calls nested `setConfig()`.

```javascript
// Maximum reliability ON (default)
{
  geolocation: {
    desiredAccuracy: High,
    distanceFilter: 10,
    disableElasticity: false,
    stopTimeout: 5,
    pausesLocationUpdatesAutomatically: false,
    locationAuthorizationRequest: 'Always',
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
    // review geolocation.filter defaults during migration
  },
  activity: {
    disableStopDetection: true,
    disableMotionActivityUpdates: false,
    stopDetectionDelay: 60_000,
    minimumActivityRecognitionConfidence: 55,
    activityRecognitionInterval: 5000,
    motionTriggerDelay: 0,
  },
  app: {
    stopOnTerminate: false,
    startOnBoot: true,
    enableHeadless: true,
    preventSuspend: true,
    heartbeatInterval: 60,
    foregroundService: true,
    notification: { title: 'LifeMap', text: '...' },
    backgroundPermissionRationale: { ... },
  },
  http: { autoSync: false, batchSync: false },
  persistence: { maxRecordsToPersist: -1 },
  logger: { debug: false, logLevel: Warning },
}

// Balanced (user disables Maximum reliability) — Motion-gated, lower battery
{
  activity: { disableStopDetection: false },
  geolocation: { pausesLocationUpdatesAutomatically: true },  // SDK default behavior
  app: { preventSuspend: false, heartbeatInterval: 60 },    // heartbeat may not fire on iOS
}
```

**When:** Do this **first** so items 4–7 apply through one typed config path.

## Implementation checklist

1. **Migrate to v5 nested config** — Replace flat `getTrackingPresetConfig()` with typed `getTrackingConfig(maxReliability)`. Nest all keys into `geolocation` / `activity` / `app` / `http` / `persistence` / `logger`. Move `locationAuthorizationRequest` → `geolocation`. Add `app.enableHeadless: true`. Review `geolocation.filter` defaults. Implement `applyTrackingProfile()` via grouped `setConfig()`.
2. **Filter `location.sample`** — In `onLocation`, skip `location.sample === true` before persisting (doc-required; avoids duplicate jitter from `getCurrentPosition` / `onMotionChange` multi-sampling).
3. **GPS speed trigger** — In `onLocation`, if `coords.speed` ≥ **4.5 m/s (~10 mph)**, call `changePace(true)` and save (in addition to heartbeat watchdog).
4. **Fix heartbeat stale GPS** — Add `HEARTBEAT_CURRENT_POSITION_REQUEST` constant (`maximumAge: 0`, `desiredAccuracy: 25`, `samples: 1`, `persist: false`, `timeout: 30`). Use in `runHeartbeat()` and headless `Heartbeat` handler. `changePace(true)` when drift/speed warrants.
5. **Home geofence exit** — Register `onGeofence` before `ready()`; `addGeofence` on saved Home at **20 m** with `notifyOnExit: true`; on EXIT → `changePace(true)` + save. Re-add on Home save/edit.
6. **Maximum reliability ON** — Wire Settings toggle; default `tracking_max_reliability: true`; `applyTrackingProfile(true)` sets nested max profile; `false` sets balanced profile.
7. **Apply activity config** — nested `activity`: confidence 55, Android poll 5s, `motionTriggerDelay: 0`; fix `stopDetectionDelay` 5m → 60–90s, `stopTimeout` 30m → 5m.
8. **Change `distanceFilter`** — nested `geolocation.distanceFilter`: 25m → 10m, keep elasticity on.
9. **Tune departure watchdog** — `DEPARTURE_WATCHDOG_MIN_MS` 15m → **5m**; `MIN_DEPARTURE_SPEED_MS` 2 → **4.5 m/s**.
10. **Place & timeline radius → 20 m** — `DEFAULT_SAVED_PLACE_RADIUS_METERS`, schema default, `HISTORY_SAME_PLACE_RADIUS_METERS`, geofence, Settings/UI copy.
11. **Extend headless task** — In `index.js` handler: add `Heartbeat`, `MotionChange`, `Geofence` cases (not only `Location`); mirror foreground logic for DB writes + `changePace`.
12. **Fix stationary ping timestamps** — Use current time when persisting heartbeat pings so dedupe does not swallow rows.
13. **Visit/drive classification** — Keep mall **spread envelope** (250–400 m) separate from **20 m pin**; add implied-speed gate on `isMeaningfulTravel`; document thresholds in `trip-detection.ts`.
14. **iOS license for TestFlight** — Add `TSLocationManagerLicense` (JWT trial/production) before Release dogfood; validate background GPS on TestFlight build, not only Debug.

## Later stage (not in this pass)

- **Keychain + encrypted DB background access** — Review Keychain accessibility (`WHEN_UNLOCKED` vs `AFTER_FIRST_UNLOCK`) for cold-start / headless edge cases. Normal background saves use a warm DB connection and are not the Jun 11 failure mode. Defer until after reliability fixes ship.
- **`Config.reset: false`** — Only after config is stable in production; until then omit `reset` (default `true`) so dev builds pick up config changes.

## Phase 2 (optional polish)

- Dynamic `distanceFilter` from GPS speed (elasticity already covers most cases).
- Log `onActivityChange` to `tracking_events` for debugging Motion vs GPS disagreements.
- `onLocation` error callback — log `LocationError` to diagnostics.
- `startBackgroundTask` / `stopBackgroundTask` on iOS if heartbeat DB writes get cut off (~180s window).
- `onEnabledChange` — sync UI if SDK stops itself (permissions revoked).
- `onPowerSaveChange` / `deviceSettings` — prompt user when OEM battery saver throttles GPS.
- Verbose debug pass: `logger: { debug: true, logLevel: Verbose }` + `BackgroundGeolocation.logger.emailLog()` for field reports.

## Reference

### Transistor docs (read order)

1. [Philosophy of Operation](https://docs.transistorsoft.com/help/philosophy-of-operation/) — MOVING vs STATIONARY state machine
2. [BackgroundGeolocation](https://docs.transistorsoft.com/react-native/BackgroundGeolocation/) — lifecycle, events, methods
3. [Config](https://docs.transistorsoft.com/react-native/Config/) — compound config root
4. [GeoConfig](https://docs.transistorsoft.com/react-native/GeoConfig/) · [ActivityConfig](https://docs.transistorsoft.com/react-native/ActivityConfig/) · [AppConfig](https://docs.transistorsoft.com/react-native/AppConfig/)
5. [CurrentPositionRequest](https://docs.transistorsoft.com/react-native/CurrentPositionRequest/) · [WatchPositionRequest](https://docs.transistorsoft.com/react-native/WatchPositionRequest/) — one-shot vs streaming GPS
6. [LocationFilter](https://docs.transistorsoft.com/react-native/LocationFilter/) — v5 on-device filtering
7. [Debugging](https://docs.transistorsoft.com/help/debugging/) · [FAQ](https://docs.transistorsoft.com/help/faq/)

### LifeMap evidence

- User export `all data.json`: Jun 11–12 gaps, zero `isMoving: true`, zero `departure_force_moving`
- Life360 on same phone captured drives LifeMap missed — compare implied speed + point density

### Design stance

- Life360-style: **GPS speed + distance primary**; Motion secondary wake signal
- Any-one-signal-wins wake model (Motion, speed, drift, geofence, heartbeat)
