import { makeMoment } from './helpers/fixtures';
import { getMomentVoiceDurationMs } from '../src/lib/moments/moment-voice';

describe('getMomentVoiceDurationMs', () => {
  it('reads voice moment duration from caption', () => {
    const moment = makeMoment({
      id: 1,
      type: 'voice',
      timestamp: new Date(),
      contentPath: '/voice.m4a',
      caption: '45',
    });
    expect(getMomentVoiceDurationMs(moment)).toBe(45_000);
  });

  it('reads photo voice attachment duration from voiceDurationSec', () => {
    const moment = makeMoment({
      id: 2,
      type: 'photo',
      timestamp: new Date(),
      contentPath: '/photo.jpg',
      caption: 'Ocean day',
      voiceAttachmentPath: '/voice.m4a',
      voiceDurationSec: 32,
    });
    expect(getMomentVoiceDurationMs(moment)).toBe(32_000);
  });
});
