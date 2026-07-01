import type {PlaceLookupCandidate, PlaceLookupCandidateKind} from '@/lib/place-lookup-types';
import {
  parseNotePhotoAttachments,
  serializeNotePhotoAttachments,
} from '@/lib/moments/note-photo-attachments';

function isPlaceLookupCandidateKind(value: unknown): value is PlaceLookupCandidateKind {
  return value === 'poi' || value === 'address';
}

export function parsePlaceLookupCandidates(
  raw: string | null | undefined,
): PlaceLookupCandidate[] {
  if (!raw?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(item => {
        if (typeof item !== 'object' || item == null) {
          return null;
        }

        const id = 'id' in item && typeof item.id === 'string' ? item.id.trim() : '';
        const name =
          'name' in item && typeof item.name === 'string' ? item.name.trim() : '';
        const kind = 'kind' in item ? item.kind : null;
        const distanceM =
          'distanceM' in item &&
          typeof item.distanceM === 'number' &&
          Number.isFinite(item.distanceM)
            ? item.distanceM
            : null;

        if (!id || !name || !isPlaceLookupCandidateKind(kind) || distanceM == null) {
          return null;
        }

        return {id, name, kind, distanceM};
      })
      .filter((item): item is PlaceLookupCandidate => item != null);
  } catch {
    return [];
  }
}

export function sanitizeCandidatesJson(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }

  const candidates = parsePlaceLookupCandidates(raw);
  return candidates.length > 0 ? JSON.stringify(candidates) : null;
}

export function serializePlaceLookupCandidates(
  candidates: PlaceLookupCandidate[],
): string | null {
  if (candidates.length === 0) {
    return null;
  }

  return sanitizeCandidatesJson(JSON.stringify(candidates));
}

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
