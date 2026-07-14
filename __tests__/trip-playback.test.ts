import {
  buildDensePlaybackSamples,
  getPlaybackLabelCenterOffset,
  getPlaybackLabelPlacement,
  getTripPlaybackFrame,
} from '../src/lib/trip-playback';

describe('trip playback', () => {
  it('places label top/bottom for horizontal segments', () => {
    expect(
      getPlaybackLabelPlacement(
        { lat: 33.21, lng: -97.15 },
        { lat: 33.21, lng: -97.1 },
      ),
    ).toMatch(/top|bottom/);
  });

  it('places label left/right for vertical segments', () => {
    expect(
      getPlaybackLabelPlacement(
        { lat: 33.2, lng: -97.13 },
        { lat: 33.25, lng: -97.13 },
      ),
    ).toMatch(/left|right/);
  });

  it('offsets the time chip away from the dot anchor', () => {
    expect(getPlaybackLabelCenterOffset('top').y).toBeLessThan(0);
    expect(getPlaybackLabelCenterOffset('bottom').y).toBeGreaterThan(0);
    expect(getPlaybackLabelCenterOffset('left').x).toBeLessThan(0);
    expect(getPlaybackLabelCenterOffset('right').x).toBeGreaterThan(0);
  });

  it('moves smoothly along distance, not time gaps', () => {
    const start = new Date('2026-06-03T08:00:00');
    const points = [
      {
        id: 1,
        timestamp: start,
        lat: 33.21,
        lng: -97.13,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
        heading: null,
        headingAccuracy: null,
        speedAccuracy: null,
        altitudeAccuracy: null,
        activityType: null,
        activityConfidence: null,
        isMoving: null,
        isMock: null,
        uuid: null,
        batteryLevel: null,
        batteryIsCharging: null,
      },
      {
        id: 2,
        timestamp: new Date(start.getTime() + 30 * 60_000),
        lat: 33.22,
        lng: -97.12,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
        heading: null,
        headingAccuracy: null,
        speedAccuracy: null,
        altitudeAccuracy: null,
        activityType: null,
        activityConfidence: null,
        isMoving: null,
        isMock: null,
        uuid: null,
        batteryLevel: null,
        batteryIsCharging: null,
      },
    ];

    const dense = buildDensePlaybackSamples(points);
    const mid = getTripPlaybackFrame(points, 0.5, dense);
    expect(mid?.coordinate.latitude).toBeGreaterThan(33.21);
    expect(mid?.coordinate.latitude).toBeLessThan(33.22);
    expect(mid?.pathCoordinates.length).toBeGreaterThan(2);
  });
});
