let revision = 0;
const listeners = new Set<() => void>();

export function getPlaceLookupRevision(): number {
  return revision;
}

export function subscribePlaceLookup(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyPlaceLookupUpdated(): void {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}
