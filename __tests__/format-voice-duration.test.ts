import {
  formatVoiceDurationCap,
  formatVoiceDurationMs,
  isVoiceDurationAtCap,
} from '../src/lib/moments/format-voice-duration';
import { VOICE_MAX_DURATION_MS } from '@/lib/app-constants';

describe('formatVoiceDurationMs', () => {
  it('formats seconds as m:ss', () => {
    expect(formatVoiceDurationMs(0)).toBe('0:00');
    expect(formatVoiceDurationMs(5_000)).toBe('0:05');
    expect(formatVoiceDurationMs(65_000)).toBe('1:05');
    expect(formatVoiceDurationMs(300_000)).toBe('5:00');
  });
});

describe('isVoiceDurationAtCap', () => {
  it('detects when recording reached the max duration', () => {
    expect(isVoiceDurationAtCap(VOICE_MAX_DURATION_MS - 1)).toBe(false);
    expect(isVoiceDurationAtCap(VOICE_MAX_DURATION_MS)).toBe(true);
  });
});

describe('formatVoiceDurationCap', () => {
  it('matches the configured max duration label', () => {
    expect(formatVoiceDurationCap()).toBe('5:00');
  });
});
