import {insertMoment, type MomentRow} from '@/db/repositories/moments';
import {VOICE_CONTENT_FORMAT} from '@/lib/moments/media-compress-config';
import {moveFileToMomentSandbox} from '@/lib/moments/moment-storage';

const MIN_VOICE_DURATION_MS = 500;

export function isVoiceRecordingTooShort(durationMs: number): boolean {
  return durationMs < MIN_VOICE_DURATION_MS;
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
    textBody: textBody?.trim() || null,
  });
}
