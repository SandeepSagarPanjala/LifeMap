import type { MomentRow } from '@/db/repositories/moments';
import { formatVoiceDurationMs } from '@/lib/moments/format-voice-duration';

export function resolveMomentVoiceContentPath(
  moment: MomentRow,
): string | null {
  if (moment.type === 'voice') {
    return moment.contentPath;
  }
  return moment.voiceAttachmentPath;
}

export function getMomentVoiceDurationMs(moment: MomentRow): number | null {
  const voicePath = resolveMomentVoiceContentPath(moment);
  if (!voicePath) {
    return null;
  }

  if (moment.voiceDurationSec != null && moment.voiceDurationSec > 0) {
    return moment.voiceDurationSec * 1000;
  }

  if (moment.type === 'voice' || moment.type === 'note') {
    const seconds = moment.caption ? Number(moment.caption) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }

  return null;
}

export function formatMomentVoiceDuration(moment: MomentRow): string | null {
  const durationMs = getMomentVoiceDurationMs(moment);
  return durationMs != null ? formatVoiceDurationMs(durationMs) : null;
}

export function momentHasVoiceAttachment(moment: MomentRow): boolean {
  return resolveMomentVoiceContentPath(moment) != null;
}
