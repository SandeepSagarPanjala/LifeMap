let revision = 0;
let busy = false;
const listeners = new Set<() => void>();

export function getMaterializationRevision(): number {
  return revision;
}

export function isMaterializationBusy(): boolean {
  return busy;
}

export function subscribeMaterialization(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function setMaterializationBusy(next: boolean): void {
  if (busy === next) {
    return;
  }
  busy = next;
  notify();
}

export function notifyMaterializationUpdated(): void {
  notify();
}
