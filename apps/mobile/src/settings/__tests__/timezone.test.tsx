import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../query';
import type { Repo } from '../../data/repo';
import { shouldUpdateTimezone, useTimezoneSync } from '../timezone';

describe('shouldUpdateTimezone', () => {
  it('is true when the device zone differs from the profile', () => {
    expect(shouldUpdateTimezone('Europe/Paris', 'Africa/Tunis')).toBe(true);
  });

  it('is false when they match', () => {
    expect(shouldUpdateTimezone('Europe/Paris', 'Europe/Paris')).toBe(false);
  });

  it('is true when the profile has no zone yet', () => {
    expect(shouldUpdateTimezone(null, 'Europe/Paris')).toBe(true);
    expect(shouldUpdateTimezone('', 'Europe/Paris')).toBe(true);
  });

  it('is false when the device zone is unknown', () => {
    expect(shouldUpdateTimezone('Europe/Paris', undefined)).toBe(false);
    expect(shouldUpdateTimezone('Europe/Paris', '')).toBe(false);
  });
});

describe('useTimezoneSync', () => {
  it('syncs on mount and again each time the app comes to the foreground', async () => {
    const listeners: ((s: string) => void)[] = [];
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      listeners.push(fn as (s: string) => void);
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const repo = {
      getProfile: jest.fn().mockResolvedValue({ timezone: 'Nowhere/Else' }),
      updateProfile: jest.fn().mockResolvedValue(undefined),
    } as unknown as Repo;
    const client = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = await renderHook(() => useTimezoneSync(repo, 'guest', null), { wrapper });
    await act(async () => {});
    expect(repo.getProfile).toHaveBeenCalledTimes(1);
    await act(async () => listeners.forEach((fn) => fn('background')));
    expect(repo.getProfile).toHaveBeenCalledTimes(1);
    await act(async () => listeners.forEach((fn) => fn('active')));
    expect(repo.getProfile).toHaveBeenCalledTimes(2);
    expect(repo.updateProfile).toHaveBeenCalledTimes(2);
    await hook.unmount();
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
    client.clear();
  });
});
