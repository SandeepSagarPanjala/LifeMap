import { insertMoment, type MomentRow } from '@/db/repositories/moments';
import {
  VOICE_CONTENT_FORMAT,
  VOICE_NOTE_MAX_LENGTH,
} from '@/lib/app-constants';
import { moveFileToMomentSandbox } from '@/lib/moments/moment-storage';

const MIN_VOICE_DURATION_MS = 500;

export function isVoiceRecordingTooShort(durationMs: number): boolean {
  return durationMs < MIN_VOICE_DURATION_MS;
}

function clipVoiceNote(textBody: string | null | undefined): string | null {
  const trimmed = textBody?.trim() || null;
  if (trimmed == null) {
    return null;
  }
  return trimmed.length > VOICE_NOTE_MAX_LENGTH
    ? trimmed.slice(0, VOICE_NOTE_MAX_LENGTH)
    : trimmed;
}

export async function saveVoiceMoment(
  tempFilePath: string,
  durationMs: number,
  textBody?: string | null,
): Promise<MomentRow> {
  if (isVoiceRecordingTooShort(durationMs)) {
    throw new Error('Recording is too short to save.');
  }

  const sandboxFile = await moveFileToMomentSandbox(tempFilePath, 'm4a');

  return insertMoment({
    type: 'voice',
    timestamp: new Date(),
    contentPath: sandboxFile.contentPath,
    contentBytes: sandboxFile.contentBytes,
    contentFormat: VOICE_CONTENT_FORMAT,
    caption: String(Math.round(durationMs / 1000)),
    textBody: clipVoiceNote(textBody),
  });
}
