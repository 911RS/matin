import { forgetUserPrefs } from './prefs';

export interface FileCleanup {
  clearImageCache(): Promise<void>;
  removePending(userId: string): void;
}

export async function forgetLocalFiles(userId: string | null, cleanup: FileCleanup): Promise<void> {
  await cleanup.clearImageCache().catch(() => {});
  if (!userId) return;
  try {
    cleanup.removePending(userId);
  } catch {}
}

export interface SignOutDeps {
  claimPushToken(token: null): Promise<void>;
  cancelReminder(): Promise<void>;
  clearCache(): void;
  signOut(): Promise<void>;
  forgetFiles(): Promise<void>;
}

export async function signOutFlow(deps: SignOutDeps): Promise<void> {
  await deps.claimPushToken(null);
  await deps.cancelReminder().catch(() => {});
  await deps.signOut();
  deps.clearCache();
  await deps.forgetFiles().catch(() => {});
}

export interface DeleteDeps {
  clearMutations(): void;
  deleteAccount(): Promise<void>;
  cancelReminder(): Promise<void>;
  forgetFiles(): Promise<void>;
}

export async function deleteCloudAccount(userId: string, deps: DeleteDeps): Promise<void> {
  deps.clearMutations();
  await deps.deleteAccount();
  await deps.cancelReminder().catch(() => {});
  await deps.forgetFiles().catch(() => {});
  await forgetUserPrefs(userId).catch(() => {});
}

export interface DeleteLocalDeps extends DeleteDeps {
  endGuest(): Promise<void>;
  resetQueries(): Promise<void>;
}

export async function deleteLocalData(userId: string, deps: DeleteLocalDeps): Promise<void> {
  deps.clearMutations();
  await deps.deleteAccount();
  await deps.cancelReminder().catch(() => {});
  await deps.forgetFiles().catch(() => {});
  await forgetUserPrefs(userId).catch(() => {});
  await deps.endGuest();
  await deps.resetQueries();
}
