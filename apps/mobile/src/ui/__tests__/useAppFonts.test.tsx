import { act, renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { FONT_TIMEOUT_MS, useAppFonts } from '../useAppFonts';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

const mockUseFonts = useFonts as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAppFonts', () => {
  it('is ready with Instrument Sans once fonts load', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toEqual({ ready: true, failed: false });
  });

  it('falls back when loading fails', async () => {
    mockUseFonts.mockReturnValue([false, new Error('nope')]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toEqual({ ready: true, failed: true });
  });

  it('waits, then gives up after the timeout', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toEqual({ ready: false, failed: false });
    await act(async () => {
      jest.advanceTimersByTime(FONT_TIMEOUT_MS - 1);
    });
    expect(result.current.ready).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toEqual({ ready: true, failed: true });
  });
});
