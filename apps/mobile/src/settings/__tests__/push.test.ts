import { applyReminder, ensurePermission, registerPush, reminderPlan } from '../push';
import type { PushDeps, ReminderDeps } from '../push';

function pushDeps(granted: boolean, overrides: Partial<PushDeps> = {}): PushDeps {
  return {
    getPermissions: jest.fn().mockResolvedValue({ granted, canAskAgain: false }),
    requestPermissions: jest.fn().mockResolvedValue({ granted, canAskAgain: false }),
    getExpoPushToken: jest.fn().mockResolvedValue('ExponentPushToken[abc]'),
    projectId: 'project-1',
    remoteSupported: true,
    ...overrides,
  };
}

describe('registerPush', () => {
  it('returns null when permission is denied', async () => {
    const d = pushDeps(false);
    await expect(registerPush(d)).resolves.toBeNull();
    expect(d.getExpoPushToken).not.toHaveBeenCalled();
  });

  it('returns null without asking for a token when projectId is missing', async () => {
    const d = pushDeps(true, { projectId: undefined, remoteSupported: true });
    await expect(registerPush(d)).resolves.toBeNull();
    expect(d.getExpoPushToken).not.toHaveBeenCalled();
  });

  it('returns the token when permission is granted', async () => {
    const d = pushDeps(true);
    await expect(registerPush(d)).resolves.toBe('ExponentPushToken[abc]');
    expect(d.getExpoPushToken).toHaveBeenCalledWith('project-1');
  });

  it('never asks for permission, even when it still could', async () => {
    const d = pushDeps(false, {
      getPermissions: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
    });
    await expect(registerPush(d)).resolves.toBeNull();
    expect(d.requestPermissions).not.toHaveBeenCalled();
  });
});

describe('ensurePermission', () => {
  it('asks when it still can', async () => {
    const d = pushDeps(false, {
      getPermissions: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
      requestPermissions: jest.fn().mockResolvedValue({ granted: true }),
    });
    await expect(ensurePermission(d)).resolves.toBe(true);
    expect(d.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('does not ask again once the user has refused for good', async () => {
    const d = pushDeps(false);
    await expect(ensurePermission(d)).resolves.toBe(false);
    expect(d.requestPermissions).not.toHaveBeenCalled();
  });
});

describe('reminderPlan', () => {
  const profile = { push_time: '07:45:00' };

  it('is remote for a cloud account with a project id', () => {
    expect(reminderPlan(profile, { account: 'cloud', enabled: true, projectId: 'p', remoteSupported: true })).toEqual({
      kind: 'remote',
    });
  });

  it('is a local reminder when remote push is unsupported (Expo Go)', () => {
    expect(reminderPlan(profile, { account: 'cloud', enabled: true, projectId: 'p', remoteSupported: false })).toEqual({
      kind: 'local',
      hour: 7,
      minute: 45,
    });
  });

  it('is a local reminder for guests', () => {
    expect(reminderPlan(profile, { account: 'local', enabled: true, projectId: 'p', remoteSupported: true })).toEqual({
      kind: 'local',
      hour: 7,
      minute: 45,
    });
  });

  it('falls back to a local reminder when the cloud account has no project id', () => {
    expect(reminderPlan({ push_time: '21:00:00' }, { account: 'cloud', enabled: true, projectId: undefined, remoteSupported: true })).toEqual({
      kind: 'local',
      hour: 21,
      minute: 0,
    });
  });

  it('is none when notifications are off', () => {
    expect(reminderPlan(profile, { account: 'local', enabled: false, projectId: undefined, remoteSupported: true })).toEqual({ kind: 'none' });
    expect(reminderPlan(profile, { account: 'cloud', enabled: false, projectId: 'p', remoteSupported: true })).toEqual({ kind: 'none' });
  });

  it('is none until the profile is known or when the time is invalid', () => {
    expect(reminderPlan(undefined, { account: 'local', enabled: true, projectId: undefined, remoteSupported: true })).toEqual({ kind: 'none' });
    expect(reminderPlan({ push_time: 'soon' }, { account: 'local', enabled: true, projectId: undefined, remoteSupported: true })).toEqual({
      kind: 'none',
    });
  });
});

const NOW_MS = Date.parse('2026-10-13T07:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('applyReminder', () => {
  function reminderDeps(overrides: Partial<ReminderDeps> = {}): ReminderDeps & { calls: string[] } {
    const calls: string[] = [];
    const deps: ReminderDeps = {
      push: pushDeps(true),
      ensureChannel: jest.fn(async () => {
        calls.push('channel');
      }),
      scheduleDaily: jest.fn(async (hour: number, minute: number) => {
        calls.push(`schedule ${hour}:${minute}`);
      }),
      cancelDaily: jest.fn(async () => {
        calls.push('cancel');
      }),
      saveTimezone: jest.fn(async () => {
        calls.push('timezone');
      }),
      claimPushToken: jest.fn(async (token: string | null) => {
        calls.push(`claim ${token}`);
      }),
      currentToken: null,
      readStamp: jest.fn(async () => null),
      writeStamp: jest.fn(async () => {}),
      now: () => NOW_MS,
      ...overrides,
    };
    return Object.assign(deps, { calls });
  }

  it('schedules a daily local reminder after creating the channel', async () => {
    const d = reminderDeps();
    await expect(applyReminder({ kind: 'local', hour: 7, minute: 30 }, d)).resolves.toBe('scheduled');
    expect(d.calls).toEqual(['cancel', 'channel', 'schedule 7:30']);
  });

  it('does not schedule when permission is denied', async () => {
    const d = reminderDeps({ push: pushDeps(false) });
    await expect(applyReminder({ kind: 'local', hour: 7, minute: 30 }, d)).resolves.toBe('denied');
    expect(d.scheduleDaily).not.toHaveBeenCalled();
  });

  it('never asks for permission in the background', async () => {
    const undetermined = pushDeps(false, {
      getPermissions: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
    });
    const d = reminderDeps({ push: undetermined });
    await expect(applyReminder({ kind: 'local', hour: 7, minute: 0 }, d)).resolves.toBe('denied');
    await expect(applyReminder({ kind: 'remote' }, d)).resolves.toBe('denied');
    expect(undetermined.requestPermissions).not.toHaveBeenCalled();
    expect(d.scheduleDaily).not.toHaveBeenCalled();
  });

  it('saves the timezone before the remote token', async () => {
    const d = reminderDeps();
    await expect(applyReminder({ kind: 'remote' }, d)).resolves.toBe('registered');
    expect(d.calls).toEqual(['cancel', 'channel', 'timezone', 'claim ExponentPushToken[abc]']);
  });

  it('keeps the existing token and schedules nothing on a transient token error', async () => {
    const push = pushDeps(true, { getExpoPushToken: jest.fn().mockRejectedValue(new Error('SERVICE_NOT_AVAILABLE')) });
    const d = reminderDeps({ push, currentToken: 'ExponentPushToken[old]' });
    await expect(applyReminder({ kind: 'remote' }, d)).resolves.toBe('kept');
    expect(d.calls).toEqual(['cancel', 'channel']);
    expect(d.scheduleDaily).not.toHaveBeenCalled();
    expect(d.claimPushToken).not.toHaveBeenCalled();
    expect(d.writeStamp).not.toHaveBeenCalled();
  });

  it('does not schedule a local reminder next to remote push, so the user gets one notification', async () => {
    const push = pushDeps(true, { getExpoPushToken: jest.fn().mockRejectedValue(new Error('timeout')) });
    const d = reminderDeps({ push });
    await expect(applyReminder({ kind: 'remote' }, d)).resolves.toBe('kept');
    expect(d.scheduleDaily).not.toHaveBeenCalled();
  });

  it('skips the token request when the same token was fetched less than 24 h ago', async () => {
    const d = reminderDeps({
      currentToken: 'ExponentPushToken[abc]',
      readStamp: jest.fn(async () => ({ token: 'ExponentPushToken[abc]', at: NOW_MS - 23 * HOUR })),
    });
    await expect(applyReminder({ kind: 'remote' }, d)).resolves.toBe('kept');
    expect(d.push.getExpoPushToken).not.toHaveBeenCalled();
  });

  it('asks again once the stamp is older than 24 h, or belongs to another token, and refreshes the stamp', async () => {
    const stale = reminderDeps({
      currentToken: 'ExponentPushToken[abc]',
      readStamp: jest.fn(async () => ({ token: 'ExponentPushToken[abc]', at: NOW_MS - 25 * HOUR })),
    });
    await expect(applyReminder({ kind: 'remote' }, stale)).resolves.toBe('registered');
    expect(stale.push.getExpoPushToken).toHaveBeenCalledTimes(1);
    expect(stale.writeStamp).toHaveBeenCalledWith({ token: 'ExponentPushToken[abc]', at: NOW_MS });

    const other = reminderDeps({
      currentToken: 'ExponentPushToken[abc]',
      readStamp: jest.fn(async () => ({ token: 'ExponentPushToken[other]', at: NOW_MS - HOUR })),
    });
    await applyReminder({ kind: 'remote' }, other);
    expect(other.push.getExpoPushToken).toHaveBeenCalledTimes(1);
  });

  it('always asks when the profile has no token yet', async () => {
    const d = reminderDeps({ readStamp: jest.fn(async () => ({ token: 'ExponentPushToken[abc]', at: NOW_MS - HOUR })) });
    await expect(applyReminder({ kind: 'remote' }, d)).resolves.toBe('registered');
    expect(d.claimPushToken).toHaveBeenCalledWith('ExponentPushToken[abc]');
  });

  it('skips claiming a token the profile already has', async () => {
    const d = reminderDeps({ currentToken: 'ExponentPushToken[abc]' });
    await applyReminder({ kind: 'remote' }, d);
    expect(d.claimPushToken).not.toHaveBeenCalled();
  });

  it('cancels the local reminder and drops the remote token when off', async () => {
    const d = reminderDeps({ currentToken: 'ExponentPushToken[abc]' });
    await expect(applyReminder({ kind: 'none' }, d)).resolves.toBe('off');
    expect(d.calls).toEqual(['cancel', 'claim null']);
  });

  it('does not touch the remote token when off and none is stored', async () => {
    const d = reminderDeps();
    await applyReminder({ kind: 'none' }, d);
    expect(d.calls).toEqual(['cancel']);
  });
});
