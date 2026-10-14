import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { filesReady } from './files';

export function useFilesReady(): boolean {
  const [ready, setReady] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (ready) return;
    let active = true;
    void filesReady().then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [ready]);
  return ready;
}
