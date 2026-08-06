import { insertMoment, type MomentRow } from '@/db/repositories/moments';
import {
  VOICE_CONTENT_FORMAT,
  VOICE_TRANSCRIPT_MAX_LENGTH,
} from '@/lib/app-constants';
import { MAX_MOOD_REASON_LENGTH } from '@/lib/moments/mood-art';
import {
  deleteMomentContentFile,
  moveFileToMomentSandbox,
} from '@/lib/moments/moment-storage';

const MIN_VOICE_DURATION_MS = 500;

function clipText(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim() || null;
  if (trimmed == null) {
    return null;
  }
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export type CaptureMoodVoiceInput = {
  uri: string;
  durationMs: number;
  transcript?: string | null;
};

export type CaptureMoodInput = {
  moodLabel: string;
  moodVariant: string;
  moodReason?: string | null;
  voice?: CaptureMoodVoiceInput | null;
};

export async function saveMoodMoment(
  input: CaptureMoodInput,
): Promise<MomentRow> {
  const moodLabel = input.moodLabel.trim();
  if (!moodLabel) {
    throw new Error('Pick a mood before saving.');
  }

  const moodVariant = input.moodVariant.trim() || null;
  let moodReason = clipText(input.moodReason, MAX_MOOD_REASON_LENGTH);
  let voiceAttachmentPath: string | null = null;
  let voiceAttachmentBytes: number | null = null;
  let voiceDurationSec: number | null = null;
  let voiceTranscript: string | null = null;
  let caption: string | null = null;

  if (input.voice) {
    if (input.voice.durationMs < MIN_VOICE_DURATION_MS) {
      throw new Error('Voice reason is too short to save.');
    }
    // Voice reason replaces text reason — keep moodReason null in the row.
    moodReason = null;
    voiceTranscript = clipText(
      input.voice.transcript,
      VOICE_TRANSCRIPT_MAX_LENGTH,
    );
    try {
      const sandboxFile = await moveFileToMomentSandbox(input.voice.uri, 'm4a');
      voiceAttachmentPath = sandboxFile.contentPath;
      voiceAttachmentBytes = sandboxFile.contentBytes;
      voiceDurationSec = Math.round(input.voice.durationMs / 1000);
      caption = String(voiceDurationSec);
    } finally {
      await deleteMomentContentFile(input.voice.uri);
    }
  }

  return insertMoment({
    type: 'mood',
    timestamp: new Date(),
    moodLabel,
    moodVariant,
    moodReason,
    caption,
    voiceAttachmentPath,
    voiceAttachmentBytes,
    voiceDurationSec,
    voiceTranscript,
    contentFormat: voiceAttachmentPath != null ? VOICE_CONTENT_FORMAT : 'text',
  });
}
