import { DEFAULT_IDLE_TIMEOUT_MS } from '@/lib/app-constants';

type IdleTask = { cancel: () => void };

type IdleGlobal = typeof globalThis & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/** Yield so taps/animations can run before heavy synchronous work. */
export function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/** Schedule work when the JS thread is idle — replaces deprecated InteractionManager.runAfterInteractions. */
export function runWhenIdle(
  callback: () => void,
  timeout = DEFAULT_IDLE_TIMEOUT_MS,
): IdleTask {
  const { requestIdleCallback, cancelIdleCallback } = globalThis as IdleGlobal;

  if (requestIdleCallback && cancelIdleCallback) {
    const handle = requestIdleCallback(callback, { timeout });
    return { cancel: () => cancelIdleCallback(handle) };
  }

  const timeoutId = setTimeout(callback, 0);
  return { cancel: () => clearTimeout(timeoutId) };
}
