import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteCloudAccount, deleteLocalData, forgetLocalFiles, signOutFlow } from '../account';
import { removePendingFor } from '../../closet/pending';
import { getNotificationsOff, getLocationLabel, setLocationLabel, setNotificationsOff } from '../prefs';
import { getOnboardingDone, setOnboardingDone } from '../../onboarding/flag';

function recorder() {
  const calls: string[] = [];
  const fn = (name: string) =>
    jest.fn(async (...args: unknown[]): Promise<void> => {
      calls.push(args.length ? `${name} ${String(args[0])}` : name);
    });
  return { calls, fn };
}

beforeEach(() => AsyncStorage.clear());

describe('signOutFlow', () => {
  it('drops the push token and cancels reminders, then clears caches once signed out', async () => {
    const { calls, fn } = recorder();
    await signOutFlow({
      claimPushToken: fn('claim'),
      cancelReminder: fn('cancel'),
      clearCache: () => calls.push('clear'),
      signOut: fn('signOut'),
      forgetFiles: fn('forgetFiles'),
    });
    expect(calls).toEqual(['claim null', 'cancel', 'signOut', 'clear', 'forgetFiles']);
  });

  it('keeps the caches when signing out fails', async () => {
    const clearCache = jest.fn();
    const forgetFiles = jest.fn();
    await expect(
      signOutFlow({
        claimPushToken: jest.fn().mockResolvedValue(undefined),
        cancelReminder: jest.fn().mockResolvedValue(undefined),
        clearCache,
        signOut: jest.fn().mockRejectedValue(new Error('network')),
        forgetFiles,
      }),
    ).rejects.toThrow('network');
    expect(clearCache).not.toHaveBeenCalled();
    expect(forgetFiles).not.toHaveBeenCalled();
  });

  it('stops when the push token cannot be dropped', async () => {
    const signOut = jest.fn();
    await expect(
      signOutFlow({
        claimPushToken: jest.fn().mockRejectedValue(new Error('offline')),
        cancelReminder: jest.fn(),
        clearCache: jest.fn(),
        signOut,
        forgetFiles: jest.fn(),
      }),
    ).rejects.toThrow('offline');
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('deleteCloudAccount', () => {
  it('clears queued writes before deleting the account', async () => {
    const { calls, fn } = recorder();
    await setNotificationsOff('u1', true);
    await deleteCloudAccount('u1', {
      clearMutations: () => calls.push('clearMutations'),
      deleteAccount: fn('delete'),
      cancelReminder: fn('cancel'),
      forgetFiles: fn('forgetFiles'),
    });
    expect(calls).toEqual(['clearMutations', 'delete', 'cancel', 'forgetFiles']);
    expect(await getNotificationsOff('u1')).toBe(false);
  });

  it('forgets the remembered occasions of that user only', async () => {
    await AsyncStorage.setItem('matin-occasion:u1:2026-10-12', 'smart');
    await AsyncStorage.setItem('matin-occasion:u2:2026-10-12', 'formal');
    await deleteCloudAccount('u1', {
      clearMutations: () => {},
      deleteAccount: async () => {},
      cancelReminder: async () => {},
      forgetFiles: async () => {},
    });
    expect(await AsyncStorage.getItem('matin-occasion:u1:2026-10-12')).toBeNull();
    expect(await AsyncStorage.getItem('matin-occasion:u2:2026-10-12')).toBe('formal');
  });
});

describe('deleteLocalData', () => {
  it('wipes the local store and per-user flags, then ends guest mode', async () => {
    const { calls, fn } = recorder();
    await setOnboardingDone('local-user');
    await setLocationLabel('local-user', 'Tunis');
    await deleteLocalData('local-user', {
      clearMutations: () => calls.push('clearMutations'),
      deleteAccount: fn('delete'),
      cancelReminder: fn('cancel'),
      forgetFiles: fn('forgetFiles'),
      endGuest: fn('endGuest'),
      resetQueries: fn('reset'),
    });
    expect(calls).toEqual(['clearMutations', 'delete', 'cancel', 'forgetFiles', 'endGuest', 'reset']);
    expect(await getOnboardingDone('local-user')).toBe(false);
    expect(await getLocationLabel('local-user')).toBeNull();
  });
});

describe('forgetLocalFiles', () => {
  it('clears the image cache and removes only that user\'s pending files', async () => {
    const files = ['u1/a.webp', 'u1/a-original.jpg', 'u2/b.webp'];
    const removed: string[] = [];
    const clearImageCache = jest.fn().mockResolvedValue(undefined);
    await forgetLocalFiles('u1', {
      clearImageCache,
      removePending: (userId) =>
        removePendingFor(userId, { list: () => files, remove: (path) => void removed.push(path) }),
    });
    expect(clearImageCache).toHaveBeenCalledTimes(1);
    expect(removed).toEqual(['u1/a.webp', 'u1/a-original.jpg']);
  });

  it('still removes pending files when the image cache cannot be cleared', async () => {
    const removePending = jest.fn();
    await forgetLocalFiles('u1', { clearImageCache: jest.fn().mockRejectedValue(new Error('x')), removePending });
    expect(removePending).toHaveBeenCalledWith('u1');
  });
});
