import {MAX_NOTE_PHOTO_ATTACHMENTS} from '@/lib/app-constants';
import {
  notePhotoAttachmentPaths,
  parseNotePhotoAttachments,
  serializeNotePhotoAttachments,
} from '../src/lib/moments/note-photo-attachments';

describe('note photo attachments', () => {
  it('caps diary photos at five', () => {
    expect(MAX_NOTE_PHOTO_ATTACHMENTS).toBe(5);
  });

  it('serializes and parses photo attachment paths', () => {
    const attachments = [
      {path: 'moments/a.jpg', bytes: 100},
      {path: 'moments/b.jpg', bytes: 200},
    ];
    expect(parseNotePhotoAttachments(serializeNotePhotoAttachments(attachments))).toEqual(
      attachments,
    );
  });

  it('falls back to contentPath for legacy notes', () => {
    expect(
      notePhotoAttachmentPaths({
        contentPath: 'moments/legacy.jpg',
        photoAttachmentsJson: null,
      }),
    ).toEqual(['moments/legacy.jpg']);
  });
});
