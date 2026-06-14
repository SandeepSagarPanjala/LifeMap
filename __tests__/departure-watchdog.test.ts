import {evaluateDepartureWatchdog} from '../src/lib/departure-watchdog';
import {
  DEPARTURE_WATCHDOG_MIN_MS,
  HEARTBEAT_DEPARTURE_DISTANCE_METERS,
  STATIONARY_PING_MIN_MS,
  STATIONARY_PING_MIN_MS_MAX_RELIABILITY,
} from '../src/lib/motion-tracking-policy';

const theater = {lat: 33.217236, lng: -96.822545};
const friend = {lat: 33.229244, lng: -96.901663};

describe('evaluateDepartureWatchdog', () => {
  it('forces moving when drift exceeds 100 m', () => {
    const result = evaluateDepartureWatchdog({
      sinceLastSaveMs: 5 * 60_000,
      lastSaved: theater,
      fresh: {
        ...friend,
        accuracy: 12,
        speed: 15,
      },
    });

    expect(result.forceMoving).toBe(true);
    expect(result.shouldPersist).toBe(true);
    expect(result.source).toBe('heartbeat_departure');
    expect(result.reason).toBe('distance_threshold');
    expect(result.distanceMeters).toBeGreaterThan(HEARTBEAT_DEPARTURE_DISTANCE_METERS);
  });

  it('forces moving on speed watchdog after 5 minutes', () => {
    const result = evaluateDepartureWatchdog({
      sinceLastSaveMs: DEPARTURE_WATCHDOG_MIN_MS,
      lastSaved: theater,
      fresh: {
        lat: theater.lat + 0.0002,
        lng: theater.lng + 0.0002,
        accuracy: 10,
        speed: 12,
      },
    });

    expect(result.forceMoving).toBe(true);
    expect(result.reason).toBe('speed_watchdog');
  });

  it('does not force moving on speed alone before 5 minutes', () => {
    const result = evaluateDepartureWatchdog({
      sinceLastSaveMs: DEPARTURE_WATCHDOG_MIN_MS - 1,
      lastSaved: theater,
      fresh: {
        lat: theater.lat + 0.0002,
        lng: theater.lng + 0.0002,
        accuracy: 10,
        speed: 12,
      },
    });

    expect(result.forceMoving).toBe(false);
    expect(result.reason).toBe('recent_save');
  });

  it('persists stationary ping after 30 minutes without departure', () => {
    const result = evaluateDepartureWatchdog({
      sinceLastSaveMs: STATIONARY_PING_MIN_MS,
      lastSaved: theater,
      fresh: {
        ...theater,
        accuracy: 10,
        speed: 0,
      },
    });

    expect(result.forceMoving).toBe(false);
    expect(result.shouldPersist).toBe(true);
    expect(result.source).toBe('heartbeat_ping');
    expect(result.reason).toBe('stationary_ping');
  });

  it('persists shorter stationary ping when max reliability interval is set', () => {
    const result = evaluateDepartureWatchdog({
      sinceLastSaveMs: STATIONARY_PING_MIN_MS_MAX_RELIABILITY,
      lastSaved: theater,
      fresh: {
        ...theater,
        accuracy: 10,
        speed: 0,
      },
      stationaryPingMinMs: STATIONARY_PING_MIN_MS_MAX_RELIABILITY,
    });

    expect(result.forceMoving).toBe(false);
    expect(result.shouldPersist).toBe(true);
    expect(result.source).toBe('heartbeat_ping');
    expect(result.reason).toBe('stationary_ping');
  });

  it('checks heartbeat without persisting on recent saves', () => {
    const result = evaluateDepartureWatchdog({
      sinceLastSaveMs: 2 * 60_000,
      lastSaved: theater,
      fresh: {
        ...theater,
        accuracy: 10,
        speed: 0,
      },
    });

    expect(result.forceMoving).toBe(false);
    expect(result.shouldPersist).toBe(false);
    expect(result.reason).toBe('recent_save');
  });
});
