import {
  isVideoRecordingTooShort,
  saveVideoMoment,
} from '@/lib/moments/capture-video';

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

  it('saves compressed video moments with optional caption', async () => {
    const onProgress = jest.fn();
    const moment = await saveVideoMoment(
      'file:///tmp/video.mp4',
      2_500,
      '  Beach day ',
      onProgress,
    );
    expect(moment.type).toBe('video');
    expect(moment.caption).toBe('Beach day');
    expect(onProgress).toHaveBeenCalled();
  });
});
