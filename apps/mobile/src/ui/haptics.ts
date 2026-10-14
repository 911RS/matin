import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function haptic(kind: 'light' | 'success' = 'light'): void {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => {});
}
