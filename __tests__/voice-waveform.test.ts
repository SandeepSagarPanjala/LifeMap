import {
  generateStaticWaveformBars,
  normalizeVoiceMetering,
} from '../src/lib/moments/voice-waveform';

describe('normalizeVoiceMetering', () => {
  it('maps silence and loud levels into 0-1', () => {
    expect(normalizeVoiceMetering(-50)).toBeCloseTo(0.08, 2);
    expect(normalizeVoiceMetering(-25)).toBeCloseTo(0.5, 2);
    expect(normalizeVoiceMetering(0)).toBe(1);
  });
});

describe('generateStaticWaveformBars', () => {
  it('returns a stable decorative bar shape for playback', () => {
    const first = generateStaticWaveformBars(20, 42);
    const second = generateStaticWaveformBars(20, 42);
    expect(first).toHaveLength(20);
    expect(second).toEqual(first);
    expect(Math.max(...first)).toBeLessThanOrEqual(1);
  });
});
