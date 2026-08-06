import {
  isVideoRecordingTooLong,
  isVideoRecordingTooShort,
  saveVideoMoment,
} from '@/lib/moments/capture-video';
import { VIDEO_MAX_DURATION_MS } from '@/lib/app-constants';

jest.mock('@/lib/moments/capture-photo', () => ({
  saveMomentToGallery: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/moments/compress-video', () => ({
  compressMomentVideo: jest.fn(async (uri: string) => `${uri}-compressed`),
}));

jest.mock('@/lib/moments/moment-storage', () => ({
  persistFileToMomentSandbox: jest.fn(async () => ({
    contentPath: 'moments/test-video.mp4',
    contentBytes: 1024,
  })),
}));

jest.mock('@/db/repositories/moments', () => ({
  insertMoment: jest.fn(async input => ({
    id: 1,
    ...input,
  })),
}));

describe('capture-video', () => {
  it('rejects recordings shorter than half a second', () => {
    expect(isVideoRecordingTooShort(400)).toBe(true);
    expect(isVideoRecordingTooShort(500)).toBe(false);
  });

  it('rejects recordings longer than the 2-minute cap', () => {
    expect(isVideoRecordingTooLong(VIDEO_MAX_DURATION_MS)).toBe(false);
    expect(isVideoRecordingTooLong(VIDEO_MAX_DURATION_MS + 1)).toBe(true);
  });

  it('saves compressed video moments with optional caption', async () => {
    const onProgress = jest.fn();
    const { insertMoment } = jest.requireMock('@/db/repositories/moments') as {
      insertMoment: jest.Mock;
    };
    const moment = await saveVideoMoment(
      'file:///tmp/video.mp4',
      2_500,
      '  Beach day ',
      onProgress,
      ['Lake', 'Water'],
    );
    expect(moment.type).toBe('video');
    expect(moment.caption).toBe('Beach day');
    expect(onProgress).toHaveBeenCalled();
    expect(insertMoment).toHaveBeenCalledWith(
      expect.objectContaining({
        tagsJson: JSON.stringify(['Lake', 'Water']),
      }),
    );
  });

  it('refuses to save videos over the duration cap', async () => {
    await expect(
      saveVideoMoment('file:///tmp/video.mp4', VIDEO_MAX_DURATION_MS + 1),
    ).rejects.toThrow('Video is too long to save.');
  });
});
