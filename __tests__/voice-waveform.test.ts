import {
  generateStaticWaveformBars,
  normalizeVoiceMetering,
  throttleVoiceUi,
} from '../src/lib/moments/voice-waveform';

describe('normalizeVoiceMetering', () => {
  it('maps silence and loud levels into 0-1', () => {
    expect(normalizeVoiceMetering(-55)).toBeCloseTo(0.04, 2);
    expect(normalizeVoiceMetering(-32.5)).toBeCloseTo(0.5, 2);
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

describe('throttleVoiceUi', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancel drops a pending trailing paint', () => {
    const fn = jest.fn();
    const throttled = throttleVoiceUi(fn, 250);

    throttled(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    throttled(20000);
    throttled.cancel();
    jest.advanceTimersByTime(250);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1000);
  });
});
