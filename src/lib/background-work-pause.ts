let mapRouteFocused = true;
let blockingModalCount = 0;

export function setBackgroundWorkMapFocused(focused: boolean): void {
  mapRouteFocused = focused;
}

export function incrementBackgroundWorkBlockingModal(): void {
  blockingModalCount += 1;
}

export function decrementBackgroundWorkBlockingModal(): void {
  blockingModalCount = Math.max(0, blockingModalCount - 1);
}

export function isBackgroundWorkPaused(): boolean {
  return !mapRouteFocused || blockingModalCount > 0;
}

export async function waitUntilBackgroundWorkResumed(): Promise<void> {
  while (isBackgroundWorkPaused()) {
    await new Promise(resolve => setTimeout(resolve, 120));
  }
}
