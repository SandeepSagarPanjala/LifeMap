/**
 * Single source of truth for LifeMap constants (mobile, web, segmentation).
 */

// ——— App ———

export const APP_TIMEZONE = 'America/Chicago';

// ——— Saved places ———

export const MAX_SAVED_PLACES = 20;
export const MAX_SAVED_PLACE_LABEL_LENGTH = 30;
/** Default geofence radius for Home, Work, and favorites. */
export const DEFAULT_SAVED_PLACE_RADIUS_METERS = 150;
export const SAVED_PLACE_CIRCLE_MAX_ZOOM_DELTA = 0.012;
export const MIN_SAVED_PLACE_ADDRESS_LENGTH = 5;
export const GEOFENCE_WAKE_MIN_RADIUS_METERS = 100;

// ——— Trip detection ———

export const DEFAULT_TRIP_GAP_MINUTES = 10;
export const DEFAULT_TRIP_DWELL_MINUTES = 5;
/** Fixed same-place radius for visit detection (not exposed in Settings). */
export const HISTORY_SAME_PLACE_RADIUS_METERS = 75;
export const DEFAULT_TRIP_DWELL_RADIUS_METERS =
  HISTORY_SAME_PLACE_RADIUS_METERS;

/** Stops during a drive (Whataburger, charger, etc.) — lower than home dwell. */
export const MIN_TRIP_STOP_MINUTES = 5;

/** Minimum radius when grouping pings at a stop (GPS drift in parking lots). */
export const MIN_STOP_CLUSTER_RADIUS_METERS = 50;

/** Minimum time at one place before it counts as a visit (stay). */
export const TRIP_DWELL_CHOICES = [5, 10, 20, 30, 40, 50, 60] as const;

/** How close saves must be to count as the same place. */
export const TRIP_RADIUS_CHOICES = [20, 25, 50, 75, 100, 150] as const;

/** Minimum dwell at a saved place (Home, Work, favorites) before it counts as a visit. */
export const SAVED_PLACE_MIN_DWELL_MINUTES = 1;

/** Bump when visit/drive detection rules change — invalidates sealed day cache. */
export const TRIP_DETECTION_VERSION = 14;

/** Bump when stored route/visit geometry rules change — invalidates fast load path. */
export const TRIP_GEOMETRY_VERSION = 3;

// ——— Map layout ———

/** Neutral world view — never a specific user's city (avoids showing Denton to everyone). */
export const MAP_FALLBACK_REGION = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 120,
  longitudeDelta: 120,
} as const;

export const MAP_SETTINGS_TOP_GAP = 8;
export const MAP_SETTINGS_SIZE = 44;
export const MAP_SETTINGS_STACK_GAP = 8;
export const MAP_LOCATE_BUTTON_BOTTOM_GAP = 20;
/** Full history panel when address + event + timeline are visible. */
export const MAP_HISTORY_PANEL_HEIGHT = 308;
export const MAP_HISTORY_TIMELINE_HEIGHT = 72;
export const MAP_HISTORY_EVENT_CARD_HEIGHT = 100;
/** Extra height when the event card shows a moment counts row. */
export const MAP_HISTORY_EVENT_CARD_MOMENTS_EXTRA_HEIGHT = 44;
/** Height of the address-selection card (pager + action row). */
export const MAP_HISTORY_ADDRESS_CARD_HEIGHT = 220;
export const MAP_HISTORY_ADDRESS_CARD_GAP = 8;
export const MAP_HISTORY_FLOATING_CONTROLS_GAP = 8;
/** Gap between date navigation and the panel content below it. */
export const MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP = 8;
/** History panel slide-down duration when closing (open still uses spring). */
export const MAP_HISTORY_PANEL_CLOSE_MS = 350;
export const MAP_STACK_BUTTON_SIZE = 44;
export const MAP_STACK_BUTTON_GAP = 8;
/** Close button + gap + date row in MapDateLabel navigation mode. */
export const MAP_DATE_NAV_ROW_GAP = 10;
export const MAP_DATE_NAV_CLUSTER_HEIGHT =
  MAP_SETTINGS_SIZE + MAP_DATE_NAV_ROW_GAP + MAP_STACK_BUTTON_SIZE;
export const MAP_LEFT_STACK_COUNT = 4;
export const MAP_RIGHT_STACK_COUNT = 4;
export const MAP_STACK_BUTTON_LEFT = 16;
export const MAP_STACK_BUTTON_RIGHT = 16;

/** Visible body below the status bar for the background-work banner. */
export const BACKGROUND_WORK_BANNER_BODY_HEIGHT = 64;

export const MAP_USER_ZOOM_DELTA = 0.01;
export const VISIT_MAX_ZOOM_DELTA = 0.0008;
export const MAX_MAP_POLYLINE_POINTS = 320;
export const MAX_EMPHASIZED_TRIP_POLYLINE_POINTS = 500;
export const MOMENT_CLUSTER_MIN_ZOOM_DELTA = 0.008;

export const HISTORY_DAY_LOAD_DEBOUNCE_MS = 300;
/** Today + one browsed past day — avoids evicting today when opening history. */
export const HISTORY_DATA_CACHE_MAX_ENTRIES = 2;

export const NATIVE_HALF_SHEET_HEIGHT_RATIO = 0.5;
export const HISTORY_DATE_PICKER_HEIGHT_RATIO = 0.55;
export const VOICE_SHEET_HEIGHT_RATIO = 0.38;

// ——— Trip playback & geometry ———

export const TRIP_PLAYBACK_DURATION_MS = 13_000;
export const PLAYBACK_MARKER_FRAME_MS = 40;

export const DRIVE_DOUGLAS_PEUCKER_EPSILON_M = 15;
export const DRIVE_MIN_TURN_BEARING_DEG = 25;
export const DRIVE_MIN_POINTS_TO_SIMPLIFY = 30;

export const MIN_VISIT_IN_AREA_SPREAD_M = 100;
export const MIN_VISIT_IN_AREA_PATH_M = 120;

export const MIN_TIMELINE_GAP_MS = 2 * 60_000;
export const CONTIGUOUS_TRIP_MS = 60_000;

// ——— Today / history ———

export const TODAY_LIVE_BUFFER_MAX_SEGMENTS = 2;
export const TODAY_TAIL_CONTEXT_MS = 2 * 60 * 60_000;
export const HISTORY_COMPACT_CONTEXT_HOURS = 12;

// ——— Motion tracking ———

/** If no row written for this long while tracking, heartbeat requests a fresh GPS fix. */
export const STATIONARY_PING_MIN_MS = 30 * 60_000;

/** Shorter backup ping when maximum reliability is on (still at one place). */
export const STATIONARY_PING_MIN_MS_MAX_RELIABILITY = 10 * 60_000;

/** Heartbeat interval (seconds) — Android minimum 60; used to check stationary ping. */
export const HEARTBEAT_CHECK_INTERVAL_SEC = 60;

/** Faster heartbeat when max reliability is on (iOS preventSuspend keeps JS warmer). */
export const HEARTBEAT_CHECK_INTERVAL_SEC_MAX_RELIABILITY = 30;

/** Drift from last save that forces moving mode even if motion API stayed still (m). */
export const HEARTBEAT_DEPARTURE_DISTANCE_METERS = 100;

/** After this long without a save, speed on heartbeat can force moving mode (ms). */
export const DEPARTURE_WATCHDOG_MIN_MS = 5 * 60_000;

/** Max-reliability drives need a much shorter stale window (CVS→Shay gap was minutes). */
export const DEPARTURE_WATCHDOG_MIN_MS_MAX_RELIABILITY = 90_000;

/** Minimum speed (m/s) on heartbeat to treat as drive departure (~10 mph). */
export const MIN_DEPARTURE_SPEED_MS = 4.5;

/** Any GPS fix at or above this speed keeps the SDK in moving mode (~7 km/h). */
export const DRIVE_GPS_WAKE_SPEED_MS = 2.0;

/** Ignore speed-based departure when accuracy is worse than this (m). */
export const MAX_DEPARTURE_ACCURACY_METERS = 75;

/** Stopping threshold for heartbeat getCurrentPosition (m) — see CurrentPositionRequest. */
export const HEARTBEAT_DESIRED_ACCURACY_METERS = 25;

/** Max plausible speed between consecutive saved points when drawing a line (m/s). ~200 km/h */
export const MAX_PLAUSIBLE_SPEED_MS = 55;

/** Min gap before breaking a map line at the same place (stationary pings). */
export const SAME_PLACE_LINE_BREAK_MS = 2 * 60_000;

export const USER_COORDINATE_MIN_INTERVAL_MS = 10_000;
export const USER_COORDINATE_MIN_MOVE_METERS = 25;

// ——— Background tracking SDK ———

/** SDK distance filter while MOVING — every qualifying fix is saved. */
export const TRACKING_DISTANCE_FILTER_METERS = 10;

export const SETTINGS_KEY_TRACKING_ENABLED = 'tracking_enabled';
export const SETTINGS_KEY_TRACKING_MAX_RELIABILITY = 'tracking_max_reliability';

/** @deprecated Legacy settings key; all installs now use the fixed config. */
export const SETTINGS_KEY_TRACKING_PRESET = 'tracking_preset';

export const TRACKING_STOP_TIMEOUT_MINUTES_BALANCED = 5;
export const TRACKING_STOP_DETECTION_DELAY_MS_BALANCED = 60_000;
export const TRACKING_LOCATION_UPDATE_INTERVAL_MS_BALANCED = 60_000;
export const TRACKING_LOCATION_UPDATE_INTERVAL_MS_MAX_RELIABILITY = 30_000;
export const TRACKING_STATIONARY_RADIUS_M_BALANCED = 25;
export const TRACKING_STATIONARY_RADIUS_M_MAX_RELIABILITY = 75;
export const TRACKING_STOP_DETECTION_DELAY_MS_MAX_RELIABILITY = 30_000;
export const TRACKING_MIN_ACTIVITY_RECOGNITION_CONFIDENCE = 55;
export const TRACKING_ACTIVITY_RECOGNITION_INTERVAL_MS = 5000;

export const TRACKING_EVENTS_BLOAT_DISABLE_THRESHOLD = 50_000;
export const TRACKING_DIAGNOSTICS_RATE_LIMIT_MS = 60_000;

// ——— Place lookup ———

/** Default venue match radius for cached reverse-geocode anchors (not saved places). */
export const PLACE_LOOKUP_VENUE_RADIUS_M = 100;
export const PLACE_LOOKUP_MAX_RADIUS_M = PLACE_LOOKUP_VENUE_RADIUS_M;
/** Closest MapKit POIs kept per lookup (100m). Beyond this, use Custom. */
export const PLACE_LOOKUP_MAX_MAPKIT_POIS = 20;
export const PLACE_LOOKUP_SESSION_BUDGET = 10;
export const DEFAULT_PLACE_LOOKUP_BACKFILL_BATCH_SIZE = 10;
/** Show bottom progress strip when this many unlabeled stays need catch-up. */
export const PLACE_LOOKUP_CATCH_UP_STRIP_THRESHOLD = 3;
export const PLACE_LOOKUP_CATCH_UP_BATCH_MAX = 10;
export const PLACE_LOOKUP_CATCH_UP_DELAY_MS = 150;

// ——— Moments media ———

export const IMAGE_COMPRESS_MAX_DIMENSION = 2048;
export const IMAGE_COMPRESS_QUALITY = 0.78;
export const IMAGE_COMPRESS_FORMAT = 'jpeg' as const;

export const VOICE_MAX_DURATION_MS = 5 * 60_000;
export const VOICE_CONTENT_FORMAT = 'aac' as const;

export const VIDEO_MAX_DURATION_MS = 5 * 60_000;
export const VIDEO_CONTENT_FORMAT = 'mp4' as const;
export const VIDEO_COMPRESS_MAX_SIZE = 1280;

export const CAMERA_EDIT_MAX_DIMENSION = 4096;
export const CAMERA_EDIT_QUALITY = 1;
export const MAX_NOTE_PHOTO_ATTACHMENTS = 5;
export const MIN_VIDEO_DURATION_MS = 500;

export const VOICE_START_RECORDING_MAX_ATTEMPTS = 3;
export const VOICE_START_RECORDING_RETRY_DELAY_MS = 350;
export const VOICE_NATIVE_PROGRESS_POLL_MS = 100;

// ——— Backup ———

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_SCHEMA_VERSION = '0017_activities';

// ——— Splash ———

/** Minimum time so the underline animation is visible even when the DB opens instantly. */
export const SPLASH_MIN_MS = 400;

/** Safety cap — never block launch longer than this on a stuck migration. */
export const SPLASH_MAX_MS = 8_000;

// ——— Drive map refresh ———

export const SETTINGS_KEY_DRIVE_MAP_REFRESH_INTERVAL_MS =
  'drive_map_refresh_interval_ms';

export const DRIVE_MAP_REFRESH_INTERVAL_MS_OPTIONS = [
  10_000, 30_000, 60_000,
] as const;

export type DriveMapRefreshIntervalMs =
  (typeof DRIVE_MAP_REFRESH_INTERVAL_MS_OPTIONS)[number];

export const DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS: DriveMapRefreshIntervalMs = 30_000;

// ——— Misc ———

export const DEFAULT_IDLE_TIMEOUT_MS = 100;
export const EXPORT_SHARE_DELAY_MS = 360;

// ——— Segmentation / trip detection engine ———

export const MIN_DRIVE_DISTANCE_M = 30;
export const SAVED_PLACE_MIN_DWELL_MS = 5 * 60 * 1000;
export const MERGE_STAY_MAX_DISTANCE_M = 200;
export const MISSING_MIN_DISTANCE_M = 500;
export const MISSING_MIN_GAP_MS = 15 * 60 * 1000;

export const DEFAULT_STOP_DETECTION_CONFIG = {
  radiusM: 75,
  minDwellMs: 5 * 60 * 1000,
  maxAccuracyM: 100,
  movingSpeedMps: 2,
  sparseBridgeMinGapMs: 15 * 60 * 1000,
  sparseBridgeMaxDistanceM: 150,
  movingBurstReturnMaxMs: 30 * 60 * 1000,
} as const;

export * from './colors';
export * from './themes';
