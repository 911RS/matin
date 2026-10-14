import { act, renderHook } from '@testing-library/react-native';
import { useHistorySelection } from '../useHistorySelection';

describe('useHistorySelection', () => {
  it('moves the selected day to the new day at midnight', async () => {
    const hook = await renderHook(({ today }: { today: string }) => useHistorySelection(today), {
      initialProps: { today: '2026-10-12' },
    });
    expect(hook.result.current.selected).toBe('2026-10-12');
    await hook.rerender({ today: '2026-10-13' });
    expect(hook.result.current.selected).toBe('2026-10-13');
  });

  it('follows the rollover into a new month when the current month is shown', async () => {
    const hook = await renderHook(({ today }: { today: string }) => useHistorySelection(today), {
      initialProps: { today: '2026-10-31' },
    });
    await hook.rerender({ today: '2026-11-01' });
    expect(hook.result.current.month).toEqual({ year: 2026, month: 11 });
    expect(hook.result.current.selected).toBe('2026-11-01');
    expect(hook.result.current.atCurrent).toBe(true);
  });

  it('keeps a day the user picked', async () => {
    const hook = await renderHook(({ today }: { today: string }) => useHistorySelection(today), {
      initialProps: { today: '2026-10-12' },
    });
    await act(async () => hook.result.current.select('2026-10-05'));
    await hook.rerender({ today: '2026-10-13' });
    expect(hook.result.current.selected).toBe('2026-10-05');
  });

  it('keeps an older month the user is browsing', async () => {
    const hook = await renderHook(({ today }: { today: string }) => useHistorySelection(today), {
      initialProps: { today: '2026-10-31' },
    });
    await act(async () => hook.result.current.go(-1));
    await hook.rerender({ today: '2026-11-01' });
    expect(hook.result.current.month).toEqual({ year: 2026, month: 9 });
    expect(hook.result.current.selected).toBe('2026-09-01');
  });
});
