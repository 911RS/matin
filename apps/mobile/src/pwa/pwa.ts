import type { PwaState } from './install';

const IDLE: PwaState = {
  install: 'none',
  updateReady: false,
  promptInstall: async () => {},
  applyUpdate: () => {},
};

export function startPwa(): void {}

export function usePwa(): PwaState {
  return IDLE;
}
