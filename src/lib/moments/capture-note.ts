import {insertMoment, type MomentRow} from '@/db/repositories/moments';
import {IMAGE_COMPRESS_FORMAT, VOICE_CONTENT_FORMAT} from '@/lib/app-constants';
import {
  serializeNotePhotoAttachments,
  type NotePhotoAttachment,
} from '@/lib/moments/note-photo-attachments';
import {
  MOMENT_IMAGE_FILE_EXTENSION,
  persistFileToMomentSandbox,
  deleteMomentContentFile,
  moveFileToMomentSandbox,
} from '@/lib/moments/moment-storage';

export type CaptureNotePhotoInput = {
  uri: string;
  sourceBytes: number | null;
};

export type CaptureNoteInput = {
  openedAt: Date;
  finishedAt: Date;
  title: string;
  textBody: string;
  moodScore?: number | null;
  moodLabel?: string | null;
  photoAttachments?: CaptureNotePhotoInput[];
  voiceAttachmentUri?: string | null;
  voiceDurationMs?: number | null;
};

export function canSaveNoteDraft(title: string, textBody: string): boolean {
  return title.trim().length > 0 || textBody.trim().length > 0;
}

export function isCaptureNoteDraftDirty(input: {
  title: string;
  textBody: string;
  hasPhoto: boolean;
  hasVoice: boolean;
  hasEmotion: boolean;
}): boolean {
  return (
    input.title.trim().length > 0 ||
    input.textBody.trim().length > 0 ||
    input.hasPhoto ||
    input.hasVoice ||
    input.hasEmotion
  );
}

export async function saveNoteMoment(input: CaptureNoteInput): Promise<MomentRow> {
  if (!canSaveNoteDraft(input.title, input.textBody)) {
    throw new Error('Add a title or note before saving.');
  }

  let contentPath: string | null = null;
  let contentBytes: number | null = null;
  let sourceBytes: number | null = null;
  let voiceAttachmentPath: string | null = null;
  let voiceAttachmentBytes: number | null = null;
  let voiceCaption: string | null = null;
  let photoAttachmentsJson: string | null = null;
  const tempPhotoUris: string[] = [];

  if (input.photoAttachments?.length) {
    const savedPhotos: NotePhotoAttachment[] = [];
    try {
      for (const photo of input.photoAttachments) {
        const sandboxFile = await persistFileToMomentSandbox(
          photo.uri,
          MOMENT_IMAGE_FILE_EXTENSION,
        );
        tempPhotoUris.push(photo.uri);
        savedPhotos.push({
          path: sandboxFile.contentPath,
          bytes: sandboxFile.contentBytes,
        });
      }
      if (savedPhotos.length > 0) {
        contentPath = savedPhotos[0]!.path;
        contentBytes = savedPhotos[0]!.bytes;
        sourceBytes = input.photoAttachments.some(photo => photo.sourceBytes != null)
          ? input.photoAttachments.reduce(
              (total, photo) => total + (photo.sourceBytes ?? 0),
              0,
            )
          : null;
        photoAttachmentsJson = serializeNotePhotoAttachments(savedPhotos);
      }
    } finally {
      for (const uri of tempPhotoUris) {
        await deleteMomentContentFile(uri);
      }
    }
  }

  if (input.voiceAttachmentUri) {
    const durationMs = input.voiceDurationMs ?? 0;
    if (durationMs < 500) {
      throw new Error('Voice attachment is too short to save.');
    }
    try {
      const sandboxFile = await moveFileToMomentSandbox(input.voiceAttachmentUri, 'm4a');
      voiceAttachmentPath = sandboxFile.contentPath;
      voiceAttachmentBytes = sandboxFile.contentBytes;
      voiceCaption = String(Math.round(durationMs / 1000));
    } finally {
      await deleteMomentContentFile(input.voiceAttachmentUri);
    }
  }

  const moodLabel = input.moodLabel?.trim() || null;

  return insertMoment({
    type: 'note',
    timestamp: input.openedAt,
    finishedAt: input.finishedAt,
    title: input.title.trim() || null,
    textBody: input.textBody.trim() || null,
    moodScore: null,
    moodLabel,
    caption: voiceCaption,
    contentPath,
    contentBytes,
    voiceAttachmentPath,
    voiceAttachmentBytes,
    photoAttachmentsJson,
    sourceBytes,
    contentFormat:
      contentPath != null
        ? IMAGE_COMPRESS_FORMAT
        : voiceAttachmentPath
          ? VOICE_CONTENT_FORMAT
          : 'text',
  });
}
