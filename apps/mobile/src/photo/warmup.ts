import { Platform } from 'react-native';
import { prepareModels } from '../../modules/tenue-photo';

function start(): void {
  try {
    prepareModels().catch(() => {});
  } catch {}
}

export function warmUpPhotoModels(): void {
  if (Platform.OS !== 'web') start();
}

export function warmUpForAdding(): void {
  if (Platform.OS === 'web') start();
}
