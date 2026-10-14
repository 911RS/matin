import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { setOnboardingDone } from '../onboarding/flag';
import { setLocationLabel } from '../settings/prefs';
import { seedDemo } from './demoSeed';
import { filesReady } from './files';
import { createLocalRepo } from './localRepo';

let running: Promise<void> | null = null;

export function absoluteUrl(uri: string, base: string): string {
  return new URL(uri, base).href;
}

export async function bundledAssetUri(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  if (Platform.OS === 'web') return absoluteUrl(asset.uri, globalThis.location.href);
  await asset.downloadAsync();
  if (asset.localUri && !asset.localUri.includes(':')) {
    asset.downloaded = false;
    await asset.downloadAsync();
  }
  if (!asset.localUri?.includes(':')) throw new Error('demo asset unavailable');
  return asset.localUri;
}

function ensureDemoSeed(): Promise<void> {
  running ??= filesReady()
    .then(() =>
      seedDemo({
        repo: createLocalRepo({ kind: 'demo' }),
        storage: AsyncStorage,
        assetUri: bundledAssetUri,
        markOnboarded: (userId) => setOnboardingDone(userId),
        setLocationLabel,
        now: () => new Date(),
      }),
    )
    .then(
      () => undefined,
      (error: unknown) => {
        console.warn('Demo seed failed', error);
      },
    );
  return running;
}

export function useDemoSeed(enabled: boolean): boolean {
  const [ready, setReady] = useState(!enabled);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    ensureDemoSeed().then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return ready;
}
