export type BootstrapPriority = 'critical' | 'high' | 'low';

type TimingEntry = {
  startedAtMs: number;
  priority?: BootstrapPriority;
};

const activeTimers = new Map<string, TimingEntry>();

let traceStartMs: number | null = null;
let traceLabel: string | null = null;
let traceFinished = false;

/** Off by default — flip on when profiling cold start or fg resume. */
let bootstrapConsoleLoggingEnabled = false;

export function setBootstrapConsoleLoggingEnabled(enabled: boolean): void {
  bootstrapConsoleLoggingEnabled = enabled;
}

export function isBootstrapConsoleLoggingEnabled(): boolean {
  return bootstrapConsoleLoggingEnabled;
}

export function formatBootstrapLogTime(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function timingKey(file: string, method: string): string {
  return `${file}::${method}`;
}

function traceElapsedMs(): number | null {
  if (traceStartMs == null) {
    return null;
  }
  return Math.round(performance.now() - traceStartMs);
}

function isBootstrapTraceLogging(): boolean {
  return (
    bootstrapConsoleLoggingEnabled &&
    traceStartMs != null &&
    !traceFinished
  );
}

function finishTiming(
  file: string,
  method: string,
): { durationMs: number; priority?: BootstrapPriority } | null {
  const key = timingKey(file, method);
  const entry = activeTimers.get(key);
  if (entry == null) {
    return null;
  }
  activeTimers.delete(key);
  return {
    durationMs: Math.round(performance.now() - entry.startedAtMs),
    priority: entry.priority,
  };
}

function metaFromTiming(
  timing: { durationMs: number; priority?: BootstrapPriority } | null,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const sinceTraceMs = traceElapsedMs();
  return {
    ...(timing?.durationMs != null ? { durationMs: timing.durationMs } : {}),
    ...(timing?.priority != null ? { priority: timing.priority } : {}),
    ...(sinceTraceMs != null ? { sinceTraceMs } : {}),
    ...extra,
  };
}

export function logBootstrap(...args: unknown[]): void {
  if (!isBootstrapTraceLogging()) {
    return;
  }
  const sinceTraceMs = traceElapsedMs();
  const prefix =
    sinceTraceMs != null
      ? `[${formatBootstrapLogTime()}] [fg+${sinceTraceMs}ms]`
      : `[${formatBootstrapLogTime()}]`;
  console.log(prefix, ...args);
}

/** Begin a foreground-resume trace — logs until endBootstrapTrace when logging is enabled. */
export function beginBootstrapTrace(label = 'foreground_resume'): void {
  activeTimers.clear();
  traceLabel = label;
  traceStartMs = performance.now();
  traceFinished = false;
  // Use a fixed 0ms prefix — recomputing elapsed can already be 1ms on slow CI.
  if (bootstrapConsoleLoggingEnabled) {
    console.log(
      `[${formatBootstrapLogTime()}] [fg+0ms]`,
      'bootstrap-trace',
      label,
      'begin',
      { sinceTraceMs: 0 },
    );
  }
}

/** Milestone relative to the active trace (for grep). */
export function markBootstrapMilestone(
  phase: string,
  detail?: Record<string, unknown>,
): void {
  logBootstrap('bootstrap-trace', phase, 'milestone', {
    sinceTraceMs: traceElapsedMs(),
    ...detail,
  });
}

/** Mark foreground-resume pipeline complete. */
export function endBootstrapTrace(
  phase: string,
  detail?: Record<string, unknown>,
): void {
  if (traceStartMs == null || traceFinished) {
    return;
  }
  const totalMs = traceElapsedMs();
  const label = traceLabel;
  traceFinished = true;
  if (!bootstrapConsoleLoggingEnabled) {
    return;
  }
  const prefix =
    totalMs != null
      ? `[${formatBootstrapLogTime()}] [fg+${totalMs}ms]`
      : `[${formatBootstrapLogTime()}]`;
  console.log(prefix, 'bootstrap-trace', phase, 'complete', {
    totalMs,
    label,
    ...detail,
  });
}

export function logBootstrapStart(
  file: string,
  method: string,
  ...detail: unknown[]
): void {
  const options =
    detail.length > 0 &&
    typeof detail[0] === 'object' &&
    detail[0] != null &&
    !Array.isArray(detail[0])
      ? (detail[0] as { priority?: BootstrapPriority })
      : undefined;
  if (isBootstrapTraceLogging()) {
    activeTimers.set(timingKey(file, method), {
      startedAtMs: performance.now(),
      priority: options?.priority,
    });
  }
  logBootstrap(file, method, 'start', metaFromTiming(null, flattenDetail(detail)));
}

export function logBootstrapEnd(
  file: string,
  method: string,
  ...detail: unknown[]
): void {
  logBootstrap(
    file,
    method,
    'end',
    metaFromTiming(finishTiming(file, method), flattenDetail(detail)),
  );
}

export function logBootstrapReturn(
  file: string,
  method: string,
  reason: string,
  ...detail: unknown[]
): void {
  logBootstrap(
    file,
    method,
    'return',
    reason,
    metaFromTiming(finishTiming(file, method), flattenDetail(detail)),
  );
}

function flattenDetail(detail: unknown[]): Record<string, unknown> | undefined {
  if (detail.length === 0) {
    return undefined;
  }
  if (
    detail.length === 1 &&
    typeof detail[0] === 'object' &&
    detail[0] != null &&
    !Array.isArray(detail[0])
  ) {
    return detail[0] as Record<string, unknown>;
  }
  return { detail };
}

/** Time an async bootstrap step when a trace is active. */
export async function runBootstrapTimed<T>(
  file: string,
  method: string,
  fn: () => Promise<T>,
  options?: {
    priority?: BootstrapPriority;
    endDetail?: Record<string, unknown> | ((result: T) => Record<string, unknown>);
  },
): Promise<T> {
  logBootstrapStart(file, method, { priority: options?.priority ?? 'high' });
  const result = await fn();
  const extra =
    typeof options?.endDetail === 'function'
      ? options.endDetail(result)
      : options?.endDetail;
  logBootstrapEnd(file, method, extra);
  return result;
}

/** @internal — reset between tests. */
export function resetBootstrapTraceForTests(): void {
  activeTimers.clear();
  traceStartMs = null;
  traceLabel = null;
  traceFinished = false;
  bootstrapConsoleLoggingEnabled = false;
}
