export type BackgroundWorkPhase =
  | 'idle'
  | 'today_seal'
  | 'past_day_seal'
  | 'place_cache';

export type BackgroundWorkProgress = {
  phase: BackgroundWorkPhase;
  message: string;
  completed: number;
  total: number;
  /** Top banner should reserve space under the status bar. */
  bannerVisible: boolean;
};

const IDLE_PROGRESS: BackgroundWorkProgress = {
  phase: 'idle',
  message: '',
  completed: 0,
  total: 0,
  bannerVisible: false,
};

let revision = 0;
let progress: BackgroundWorkProgress = IDLE_PROGRESS;
const listeners = new Set<() => void>();

export function getBackgroundWorkRevision(): number {
  return revision;
}

export function getBackgroundWorkProgress(): BackgroundWorkProgress {
  return progress;
}

export function isBackgroundWorkBannerVisible(): boolean {
  return progress.bannerVisible;
}

export function subscribeBackgroundWork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: BackgroundWorkProgress): void {
  progress = next;
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function setBackgroundWorkProgress(
  patch: Partial<BackgroundWorkProgress> & {
    phase: BackgroundWorkPhase;
    message: string;
  },
): void {
  publish({
    ...progress,
    ...patch,
    bannerVisible: patch.bannerVisible ?? progress.bannerVisible,
  });
}

export function showBackgroundWorkBanner(
  patch: Omit<BackgroundWorkProgress, 'bannerVisible'>,
): void {
  publish({
    ...patch,
    bannerVisible: true,
  });
}

export function clearBackgroundWorkProgress(): void {
  publish(IDLE_PROGRESS);
}
