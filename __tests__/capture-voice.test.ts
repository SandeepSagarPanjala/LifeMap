import {isVoiceRecordingTooShort} from '../src/lib/moments/capture-voice';

describe('isVoiceRecordingTooShort', () => {
  it('requires at least half a second', () => {
    expect(isVoiceRecordingTooShort(499)).toBe(true);
    expect(isVoiceRecordingTooShort(500)).toBe(false);
    expect(isVoiceRecordingTooShort(1200)).toBe(false);
  });
});
