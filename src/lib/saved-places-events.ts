const listeners = new Set<() => void>();

export function subscribeSavedPlaces(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySavedPlacesUpdated(): void {
  for (const listener of listeners) {
    listener();
  }
}
