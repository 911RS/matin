import { afterEach, expect, test, vi } from 'vitest';
import { timeoutSignal } from '../src/signal.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('uses AbortSignal.timeout when available', () => {
  const native = {} as AbortSignal;
  const timeout = vi.fn(() => native);
  vi.stubGlobal('AbortSignal', { timeout });
  expect(timeoutSignal(50)).toBe(native);
  expect(timeout).toHaveBeenCalledWith(50);
});

test('falls back to AbortController plus setTimeout', () => {
  vi.useFakeTimers();
  vi.stubGlobal('AbortSignal', { timeout: undefined });
  const signal = timeoutSignal(100);
  expect(signal.aborted).toBe(false);
  vi.advanceTimersByTime(100);
  expect(signal.aborted).toBe(true);
});
