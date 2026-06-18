import {
  canSaveNoteDraft,
  isCaptureNoteDraftDirty,
} from '../src/lib/moments/capture-note';

describe('canSaveNoteDraft', () => {
  it('requires a title or body', () => {
    expect(canSaveNoteDraft('', '')).toBe(false);
    expect(canSaveNoteDraft('Morning coffee', '')).toBe(true);
    expect(canSaveNoteDraft('', 'Feeling good today')).toBe(true);
    expect(canSaveNoteDraft('   ', '   ')).toBe(false);
  });
});

describe('isCaptureNoteDraftDirty', () => {
  it('tracks text, photo, and mood changes', () => {
    expect(
      isCaptureNoteDraftDirty({
        title: '',
        textBody: '',
        hasPhoto: false,
        hasVoice: false,
        hasEmotion: false,
      }),
    ).toBe(false);
    expect(
      isCaptureNoteDraftDirty({
        title: 'Hi',
        textBody: '',
        hasPhoto: false,
        hasVoice: false,
        hasEmotion: false,
      }),
    ).toBe(true);
    expect(
      isCaptureNoteDraftDirty({
        title: '',
        textBody: '',
        hasPhoto: true,
        hasVoice: false,
        hasEmotion: false,
      }),
    ).toBe(true);
    expect(
      isCaptureNoteDraftDirty({
        title: '',
        textBody: '',
        hasPhoto: false,
        hasVoice: true,
        hasEmotion: false,
      }),
    ).toBe(true);
    expect(
      isCaptureNoteDraftDirty({
        title: '',
        textBody: '',
        hasPhoto: false,
        hasVoice: false,
        hasEmotion: true,
      }),
    ).toBe(true);
  });
});
