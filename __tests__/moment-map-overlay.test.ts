import {buildMomentMapPins} from '../src/components/map/MomentMapOverlay';

describe('buildMomentMapPins', () => {
  it('places photo moments on the GPS trail at capture time', () => {
    const pins = buildMomentMapPins(
      [
        {
          id: 1,
          type: 'photo',
          timestamp: new Date('2026-06-08T15:00:00.000Z'),
          finishedAt: null,
          lat: null,
          lng: null,
          contentPath: '/tmp/photo.jpg',
          textBody: null,
          caption: null,
          title: null,
          moodScore: null,
          moodLabel: null,
          placeLabel: null,
          linkedPointId: null,
          contentBytes: 100,
          sourceBytes: 1000,
          contentFormat: 'jpeg',
          shareVisibility: 'private',
          contentSyncState: 'local_only',
          voiceAttachmentPath: null,
          voiceAttachmentBytes: null,
          voiceDurationSec: null,
          photoAttachmentsJson: null,
        },
      ],
      [
        {
          id: 10,
          timestamp: new Date('2026-06-08T14:00:00.000Z'),
          lat: 33,
          lng: -97,
          accuracy: null,
          altitude: null,
          speed: null,
          source: 'gps',
        },
        {
          id: 11,
          timestamp: new Date('2026-06-08T16:00:00.000Z'),
          lat: 34,
          lng: -96,
          accuracy: null,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ],
      [],
    );

    expect(pins).toHaveLength(1);
    expect(pins[0]?.coordinate).toEqual({latitude: 33.5, longitude: -96.5});
  });
});
