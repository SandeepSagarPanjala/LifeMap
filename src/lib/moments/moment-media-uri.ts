import {Platform} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

/** Strip any file:// prefix and decode URI-encoded path segments. */
export function normalizeMomentContentPath(contentPath: string): string {
  const withoutScheme = contentPath.replace(/^file:\/\//, '');
  try {
    return decodeURI(withoutScheme);
  } catch {
    return withoutScheme;
  }
}

export function getDocumentDirectory(): string {
  return normalizeMomentContentPath(ReactNativeBlobUtil.fs.dirs.DocumentDir);
}

/** Pull `moments/...` off an absolute or relative stored path. */
export function momentStorageRelativePath(contentPath: string): string | null {
  const normalized = normalizeMomentContentPath(contentPath);
  if (!normalized.startsWith('/')) {
    return normalized;
  }
  const marker = '/moments/';
  const idx = normalized.indexOf(marker);
  if (idx >= 0) {
    return normalized.slice(idx + 1);
  }
  return null;
}

/** Resolve a stored moment path against the current app Documents directory. */
export function resolveMomentContentPath(contentPath: string): string {
  const normalized = normalizeMomentContentPath(contentPath);
  const docs = getDocumentDirectory();

  if (!normalized.startsWith('/')) {
    return `${docs}/${normalized}`;
  }

  if (normalized.startsWith(`${docs}/`)) {
    return normalized;
  }

  const relative = momentStorageRelativePath(normalized);
  if (relative) {
    return `${docs}/${relative}`;
  }

  return normalized;
}

/** Candidate filesystem paths for a stored moment (handles iOS prefix quirks). */
export function momentContentPathCandidates(contentPath: string): string[] {
  const resolved = resolveMomentContentPath(contentPath);
  const candidates = new Set<string>([resolved]);

  if (resolved.startsWith('/var/')) {
    candidates.add(`/private${resolved}`);
  }
  if (resolved.startsWith('/private/var/')) {
    candidates.add(resolved.replace('/private', ''));
  }

  return [...candidates];
}

export async function resolveExistingMomentContentPath(
  contentPath: string,
): Promise<string | null> {
  for (const candidate of momentContentPathCandidates(contentPath)) {
    if (await ReactNativeBlobUtil.fs.exists(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** URI for React Native Image. */
export function momentImageUri(contentPath: string): string {
  const path = resolveMomentContentPath(contentPath);
  return Platform.OS === 'ios' ? `file://${path}` : `file://${path}`;
}

/** Plain filesystem path for native audio players. */
export function momentPlayerPath(contentPath: string): string {
  return resolveMomentContentPath(contentPath);
}

/** @deprecated Use momentImageUri */
export function momentMediaUri(contentPath: string): string {
  return momentImageUri(contentPath);
}
