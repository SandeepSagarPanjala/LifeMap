import {insertMoment, type MomentRow} from '@/db/repositories/moments';
import {moodLabelForScore} from '@/lib/moments/mood';
import {IMAGE_COMPRESS_FORMAT} from '@/lib/moments/media-compress-config';
import {
  MOMENT_IMAGE_FILE_EXTENSION,
  persistFileToMomentSandbox,
  deleteMomentContentFile,
} from '@/lib/moments/moment-storage';

export type CaptureNoteInput = {
  openedAt: Date;
  finishedAt: Date;
  title: string;
  textBody: string;
  moodScore?: number | null;
  moodLabel?: string | null;
  attachmentUri?: string | null;
  sourceBytes?: number | null;
};

export function canSaveNoteDraft(title: string, textBody: string): boolean {
  return title.trim().length > 0 || textBody.trim().length > 0;
}

export function isCaptureNoteDraftDirty(input: {
  title: string;
  textBody: string;
  hasPhoto: boolean;
  moodTouched: boolean;
}): boolean {
  return (
    input.title.trim().length > 0 ||
    input.textBody.trim().length > 0 ||
    input.hasPhoto ||
    input.moodTouched
  );
}

export async function saveNoteMoment(input: CaptureNoteInput): Promise<MomentRow> {
  if (!canSaveNoteDraft(input.title, input.textBody)) {
    throw new Error('Add a title or note before saving.');
  }

  let contentPath: string | null = null;
  let contentBytes: number | null = null;

  if (input.attachmentUri) {
    try {
      const sandboxFile = await persistFileToMomentSandbox(
        input.attachmentUri,
        MOMENT_IMAGE_FILE_EXTENSION,
      );
      contentPath = sandboxFile.contentPath;
      contentBytes = sandboxFile.contentBytes;
    } finally {
      await deleteMomentContentFile(input.attachmentUri);
    }
  }

  const moodScore = input.moodScore ?? null;
  const moodLabel =
    input.moodLabel ??
    (moodScore != null ? moodLabelForScore(moodScore) : null);

  return insertMoment({
    type: 'note',
    timestamp: input.openedAt,
    finishedAt: input.finishedAt,
    title: input.title.trim() || null,
    textBody: input.textBody.trim() || null,
    moodScore,
    moodLabel,
    contentPath,
    contentBytes,
    sourceBytes: input.sourceBytes ?? null,
    contentFormat: contentPath ? IMAGE_COMPRESS_FORMAT : 'text',
  });
}
