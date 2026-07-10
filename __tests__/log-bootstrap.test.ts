import {
  beginBootstrapTrace,
  endBootstrapTrace,
  logBootstrapEnd,
  logBootstrapStart,
  markBootstrapMilestone,
  resetBootstrapTraceForTests,
  setBootstrapConsoleLoggingEnabled,
} from '@/lib/log-bootstrap';

describe('log-bootstrap timing', () => {
  beforeEach(() => {
    resetBootstrapTraceForTests();
    setBootstrapConsoleLoggingEnabled(true);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs durationMs on end', () => {
    beginBootstrapTrace('foreground_resume');
    logBootstrapStart('test.ts', 'foo', { priority: 'high' });
    logBootstrapEnd('test.ts', 'foo');

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[fg\+\d+ms\]/),
      'test.ts',
      'foo',
      'end',
      expect.objectContaining({
        durationMs: expect.any(Number),
        priority: 'high',
        sinceTraceMs: expect.any(Number),
      }),
    );
  });

  it('tracks milestones and total pipeline time', () => {
    beginBootstrapTrace('foreground_resume');
    markBootstrapMilestone('tracking_ready');
    endBootstrapTrace('done', { userFacing: 'map ready' });

    const calls = jest.mocked(console.log).mock.calls;
    expect(calls[0]).toEqual([
      expect.stringMatching(/\[fg\+0ms\]/),
      'bootstrap-trace',
      'foreground_resume',
      'begin',
      { sinceTraceMs: 0 },
    ]);
    expect(calls[1]?.[2]).toBe('tracking_ready');
    expect(calls[1]?.[3]).toBe('milestone');
    expect(calls[2]?.[3]).toBe('complete');
    expect(calls[2]?.[4]).toEqual(
      expect.objectContaining({
        totalMs: expect.any(Number),
        userFacing: 'map ready',
      }),
    );
  });

  it('does not log when no trace is active', () => {
    logBootstrapStart('test.ts', 'silent');
    logBootstrapEnd('test.ts', 'silent');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('does not log when console logging is disabled', () => {
    setBootstrapConsoleLoggingEnabled(false);
    beginBootstrapTrace('foreground_resume');
    logBootstrapStart('test.ts', 'silent');
    logBootstrapEnd('test.ts', 'silent');
    expect(console.log).not.toHaveBeenCalled();
  });
});
