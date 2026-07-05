export type PlaceLookupCatchUpProgress = {
  phase: 'running' | 'done' | 'aborted';
  total: number;
  completed: number;
  /** When true, show the bottom progress strip with dismiss. */
  showStrip: boolean;
  message: string | null;
};

let revision = 0;
let progress: PlaceLookupCatchUpProgress | null = null;
const listeners = new Set<() => void>();

export function getPlaceLookupCatchUpProgress(): PlaceLookupCatchUpProgress | null {
  return progress;
}

export function getPlaceLookupCatchUpRevision(): number {
  return revision;
}

export function subscribePlaceLookupCatchUp(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: PlaceLookupCatchUpProgress | null): void {
  progress = next;
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function setPlaceLookupCatchUpProgress(
  next: PlaceLookupCatchUpProgress | null,
): void {
  publish(next);
}

export function clearPlaceLookupCatchUpProgress(): void {
  publish(null);
}
