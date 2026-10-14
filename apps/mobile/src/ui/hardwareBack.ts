import { BackHandler } from 'react-native';

export function onHardwareBack(handler: () => boolean): () => void {
  const sub = BackHandler.addEventListener('hardwareBackPress', handler);
  return () => sub.remove();
}
