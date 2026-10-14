import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { devicePush } from './notifications';
import type { PermissionState } from './push';

export function usePushPermission(): [PermissionState | null, () => void] {
  const [state, setState] = useState<PermissionState | null>(null);
  const refresh = () => {
    devicePush
      .getPermissions()
      .then(({ granted, canAskAgain }) => setState({ granted, canAskAgain }))
      .catch(() => {});
  };
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, []);
  return [state, refresh];
}
