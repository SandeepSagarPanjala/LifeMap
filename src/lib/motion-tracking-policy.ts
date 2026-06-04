/** If no row written for this long while tracking, heartbeat requests a fresh GPS fix. */
export const STATIONARY_PING_MIN_MS = 30 * 60_000;

/** Heartbeat interval (seconds) — Android minimum 60; used to check stationary ping. */
export const HEARTBEAT_CHECK_INTERVAL_SEC = 60;

/** Max plausible speed between consecutive saved points when drawing a line (m/s). ~200 km/h */
export const MAX_PLAUSIBLE_SPEED_MS = 55;

/** Min gap before breaking a map line at the same place (stationary pings). */
export const SAME_PLACE_LINE_BREAK_MS = 2 * 60_000;
