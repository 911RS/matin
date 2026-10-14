export type InstallHint = 'none' | 'ios' | 'prompt';

export type InstallEnv = {
  displayModeStandalone: boolean;
  navigatorStandalone: boolean;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  hasInstallPrompt: boolean;
};

export type PwaState = {
  install: InstallHint;
  updateReady: boolean;
  promptInstall: () => Promise<void>;
  applyUpdate: () => void;
};

export function isStandalone(env: Pick<InstallEnv, 'displayModeStandalone' | 'navigatorStandalone'>): boolean {
  return env.displayModeStandalone || env.navigatorStandalone;
}

export function isIos(env: Pick<InstallEnv, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  if (/iPhone|iPad|iPod/.test(env.userAgent)) return true;
  return env.platform === 'MacIntel' && env.maxTouchPoints > 1;
}

export function installHint(env: InstallEnv): InstallHint {
  if (isStandalone(env)) return 'none';
  if (env.hasInstallPrompt) return 'prompt';
  return isIos(env) ? 'ios' : 'none';
}
