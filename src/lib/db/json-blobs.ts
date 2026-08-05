import {
  parseNotePhotoAttachments,
  serializeNotePhotoAttachments,
} from '@/lib/moments/note-photo-attachments';

export function sanitizePhotoAttachmentsJson(
  json: string | null | undefined,
): string | null {
  if (!json?.trim()) {
    return null;
  }

  const attachments = parseNotePhotoAttachments(json);
  return attachments.length > 0
    ? serializeNotePhotoAttachments(attachments)
    : null;
}
