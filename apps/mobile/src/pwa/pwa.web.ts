import { useSyncExternalStore } from 'react';
import { installHint } from './install';
import type { InstallEnv, PwaState } from './install';

type InstallPrompt = Event & { prompt: () => Promise<void> };

let deferredPrompt: InstallPrompt | null = null;
let waiting: ServiceWorker | null = null;
let started = false;
let snapshot: PwaState | null = null;
const listeners = new Set<() => void>();

function readEnv(): InstallEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    navigatorStandalone: nav.standalone === true,
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    hasInstallPrompt: deferredPrompt !== null,
  };
}

async function promptInstall(): Promise<void> {
  const prompt = deferredPrompt;
  if (!prompt) return;
  deferredPrompt = null;
  emit();
  await prompt.prompt();
}

function applyUpdate(): void {
  waiting?.postMessage({ type: 'SKIP_WAITING' });
}

function emit(): void {
  snapshot = null;
  listeners.forEach((listener) => listener());
}

function getSnapshot(): PwaState {
  snapshot ??= { install: installHint(readEnv()), updateReady: waiting !== null, promptInstall, applyUpdate };
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function track(registration: ServiceWorkerRegistration): void {
  const mark = () => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      waiting = registration.waiting;
      emit();
    }
  };
  mark();
  registration.addEventListener('updatefound', () => {
    registration.installing?.addEventListener('statechange', mark);
  });
}

function listenForInstall(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPrompt;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

listenForInstall();

function checkForUpdateWhenVisible(registration: ServiceWorkerRegistration): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration.update().catch(() => {});
  });
}

export function startPwa(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      track(registration);
      checkForUpdateWhenVisible(registration);
    })
    .catch(() => {});
}

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
