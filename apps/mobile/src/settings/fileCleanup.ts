import { Image } from 'expo-image';
import { removePendingFor } from '../closet/pending';
import type { FileCleanup } from './account';

export const deviceFileCleanup: FileCleanup = {
  async clearImageCache() {
    await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
  },
  removePending: (userId) => removePendingFor(userId),
};
