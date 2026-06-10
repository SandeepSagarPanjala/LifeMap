import {VOICE_MAX_DURATION_MS} from '@/lib/moments/media-compress-config';

export function formatVoiceDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function isVoiceDurationAtCap(
  ms: number,
  capMs: number = VOICE_MAX_DURATION_MS,
): boolean {
  return ms >= capMs;
}

export function formatVoiceDurationCap(): string {
  return formatVoiceDurationMs(VOICE_MAX_DURATION_MS);
}
