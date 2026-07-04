export type NotePhotoAttachment = {
  path: string;
  bytes: number | null;
};

export type DraftNotePhoto = {
  id: string;
  uri: string;
  sourceBytes: number | null;
};

export function parseNotePhotoAttachments(json: string | null | undefined): NotePhotoAttachment[] {
  if (!json?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(item => {
        if (typeof item !== 'object' || item == null) {
          return null;
        }
        const path = 'path' in item && typeof item.path === 'string' ? item.path.trim() : '';
        if (!path) {
          return null;
        }
        const bytes =
          'bytes' in item && typeof item.bytes === 'number' ? item.bytes : null;
        return {path, bytes};
      })
      .filter((item): item is NotePhotoAttachment => item != null);
  } catch {
    return [];
  }
}

export function serializeNotePhotoAttachments(attachments: NotePhotoAttachment[]): string {
  return JSON.stringify(attachments);
}

export function notePhotoAttachmentPaths(moment: {
  contentPath: string | null;
  photoAttachmentsJson?: string | null;
}): string[] {
  const fromJson = parseNotePhotoAttachments(moment.photoAttachmentsJson).map(item => item.path);
  if (fromJson.length > 0) {
    return fromJson;
  }
  return moment.contentPath ? [moment.contentPath] : [];
}
