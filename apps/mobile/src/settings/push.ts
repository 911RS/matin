import type { ProfileRow } from '@tenue/backend';
import { parsePushTime } from './time';

export interface PermissionState {
  granted: boolean;
  canAskAgain?: boolean;
}

export interface PermissionDeps {
  getPermissions(): Promise<PermissionState>;
  requestPermissions(): Promise<PermissionState>;
}

export interface PushDeps extends PermissionDeps {
  getExpoPushToken(projectId: string): Promise<string>;
  projectId: string | undefined;
  remoteSupported: boolean;
}

export interface TokenStamp {
  token: string;
  at: number;
}

export const TOKEN_REFRESH_MS = 24 * 60 * 60 * 1000;

type DailyTime = { hour: number; minute: number };

export type ReminderPlan =
  | { kind: 'remote' }
  | ({ kind: 'local' } & DailyTime)
  | { kind: 'none' };

export interface ReminderStatus {
  account: 'cloud' | 'local';
  enabled: boolean;
  projectId: string | undefined;
  remoteSupported: boolean;
}

export interface ReminderDeps {
  push: PushDeps;
  ensureChannel(): Promise<void>;
  scheduleDaily(hour: number, minute: number): Promise<void>;
  cancelDaily(): Promise<void>;
  saveTimezone(): Promise<void>;
  claimPushToken(token: string | null): Promise<void>;
  currentToken: string | null;
  readStamp(): Promise<TokenStamp | null>;
  writeStamp(stamp: TokenStamp): Promise<void>;
  now(): number;
}

export type ReminderOutcome = 'scheduled' | 'registered' | 'kept' | 'denied' | 'off';

export async function ensurePermission(deps: PermissionDeps): Promise<boolean> {
  const current = await deps.getPermissions();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  return (await deps.requestPermissions()).granted;
}

export async function hasPermission(deps: Pick<PermissionDeps, 'getPermissions'>): Promise<boolean> {
  return (await deps.getPermissions()).granted;
}

export async function registerPush(deps: PushDeps): Promise<string | null> {
  const { projectId } = deps;
  if (!projectId) return null;
  if (!(await hasPermission(deps))) return null;
  return deps.getExpoPushToken(projectId);
}

export function reminderPlan(
  profile: Pick<ProfileRow, 'push_time'> | undefined,
  status: ReminderStatus,
): ReminderPlan {
  if (!status.enabled || !profile) return { kind: 'none' };
  const time = parsePushTime(profile.push_time);
  if (status.account === 'cloud' && status.projectId && status.remoteSupported) return { kind: 'remote' };
  return time ? { kind: 'local', ...time } : { kind: 'none' };
}

export async function applyReminder(plan: ReminderPlan, deps: ReminderDeps): Promise<ReminderOutcome> {
  await deps.cancelDaily();
  if (plan.kind === 'none') {
    if (deps.currentToken) await deps.claimPushToken(null);
    return 'off';
  }
  await deps.ensureChannel();
  if (plan.kind === 'local') {
    if (!(await hasPermission(deps.push))) return 'denied';
    await deps.scheduleDaily(plan.hour, plan.minute);
    return 'scheduled';
  }
  if (deps.currentToken) {
    const stamp = await deps.readStamp().catch(() => null);
    const age = stamp ? deps.now() - stamp.at : Infinity;
    if (stamp?.token === deps.currentToken && age >= 0 && age < TOKEN_REFRESH_MS) return 'kept';
  }
  let token: string | null;
  try {
    token = await registerPush(deps.push);
  } catch {
    return 'kept';
  }
  if (!token) return 'denied';
  await deps.writeStamp({ token, at: deps.now() }).catch(() => {});
  if (token !== deps.currentToken) {
    await deps.saveTimezone();
    await deps.claimPushToken(token);
  }
  return 'registered';
}
