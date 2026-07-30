const listeners = new Set<() => void>();

export function subscribeHealthData(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyHealthDataUpdated(): void {
  for (const listener of listeners) {
    listener();
  }
}
