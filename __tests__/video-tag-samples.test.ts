import { videoTagSampleTimesMs } from '@/lib/moments/video-tag-samples';
import {
  MAX_PHOTO_TAGS,
  sanitizePhotoTagCandidates,
} from '@/lib/moments/moment-tags';

describe('videoTagSampleTimesMs', () => {
  it('returns three unique times for a long clip', () => {
    expect(videoTagSampleTimesMs(20_000)).toEqual([1000, 10_000, 18_000]);
  });

  it('clamps and unique-ifies short clips', () => {
    expect(videoTagSampleTimesMs(2500)).toEqual([500, 1000, 1250]);
    expect(videoTagSampleTimesMs(1500)).toEqual([0, 750, 1000]);
    expect(videoTagSampleTimesMs(800)).toEqual([0, 400, 800]);
  });

  it('handles invalid durations', () => {
    expect(videoTagSampleTimesMs(0)).toEqual([0]);
    expect(videoTagSampleTimesMs(-5)).toEqual([0]);
    expect(videoTagSampleTimesMs(Number.NaN)).toEqual([0]);
  });
});

describe('video tag merge cap', () => {
  it('keeps top 8 by confidence across frames', () => {
    const merged = sanitizePhotoTagCandidates(
      [
        { label: 'Lake', confidence: 0.9 },
        { label: 'Tree', confidence: 0.4 },
        { label: 'Sky', confidence: 0.8 },
        { label: 'Water', confidence: 0.7 },
        { label: 'Nature', confidence: 0.6 },
        { label: 'Mountain', confidence: 0.5 },
        { label: 'Beach', confidence: 0.45 },
        { label: 'Forest', confidence: 0.35 },
        { label: 'Rock', confidence: 0.3 },
        { label: 'lake', confidence: 0.95 },
        { label: 'photo', confidence: 0.99 },
      ],
      MAX_PHOTO_TAGS,
    );
    expect(merged.map(tag => tag.label)).toEqual([
      'Lake',
      'Sky',
      'Water',
      'Nature',
      'Mountain',
      'Beach',
      'Tree',
      'Forest',
    ]);
    expect(merged).toHaveLength(MAX_PHOTO_TAGS);
  });
});
