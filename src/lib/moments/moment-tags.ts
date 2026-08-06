import { MAX_PHOTO_TAG_LENGTH } from '@/lib/app-constants';

export const MAX_PHOTO_TAGS = 8;
export { MAX_PHOTO_TAG_LENGTH };

export type PhotoTagCandidate = {
  label: string;
  /** 0–1 confidence from on-device labeling. */
  confidence: number;
};

const USELESS_TAG_KEYS = new Set([
  'photograph',
  'photo',
  'image',
  'screenshot',
  'graphics',
  'art',
  'illustration',
]);

export function normalizePhotoTag(raw: string): string | null {
  let trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_PHOTO_TAG_LENGTH) {
    trimmed = trimmed.slice(0, MAX_PHOTO_TAG_LENGTH).trim();
  }
  if (!trimmed) {
    return null;
  }
  const key = trimmed.toLowerCase();
  if (USELESS_TAG_KEYS.has(key)) {
    return null;
  }
  // Title-case single words / short phrases for display.
  return trimmed
    .split(' ')
    .map(part =>
      part.length === 0
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(' ');
}

export function sanitizePhotoTags(
  tags: readonly string[],
  max = MAX_PHOTO_TAGS,
): string[] {
  return sanitizePhotoTagCandidates(
    tags.map(label => ({ label, confidence: 1 })),
    max,
  ).map(tag => tag.label);
}

export function sanitizePhotoTagCandidates(
  tags: readonly { label: string; confidence: number }[],
  max = MAX_PHOTO_TAGS,
): PhotoTagCandidate[] {
  const seen = new Set<string>();
  const out: PhotoTagCandidate[] = [];
  const ranked = [...tags].sort((a, b) => b.confidence - a.confidence);

  for (const raw of ranked) {
    const label = normalizePhotoTag(raw.label);
    if (!label) {
      continue;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    if (
      typeof raw.confidence !== 'number' ||
      !Number.isFinite(raw.confidence)
    ) {
      continue;
    }
    seen.add(key);
    out.push({
      label,
      confidence: Math.max(0, Math.min(1, raw.confidence)),
    });
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

export function parseMomentTagsJson(
  raw: string | null | undefined,
): string[] {
  if (!raw?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sanitizePhotoTags(
      parsed.filter((item): item is string => typeof item === 'string'),
    );
  } catch {
    return [];
  }
}

export function serializeMomentTagsJson(
  tags: readonly string[] | null | undefined,
): string | null {
  if (!tags || tags.length === 0) {
    return null;
  }
  const sanitized = sanitizePhotoTags(tags);
  return sanitized.length > 0 ? JSON.stringify(sanitized) : null;
}

export function sanitizeMomentTagsJson(
  raw: string | null | undefined,
): string | null {
  return serializeMomentTagsJson(parseMomentTagsJson(raw));
}
