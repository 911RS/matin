import { requireOptionalNativeModule } from 'expo';
import type { ModelStatus, ProcessedPhoto } from './types';

export type { ModelStatus, ProcessedPhoto } from './types';

interface TenuePhotoNative {
  processPhoto(uri: string): Promise<ProcessedPhoto>;
  prepareModels(): Promise<ModelStatus>;
}

const native = requireOptionalNativeModule<TenuePhotoNative>('TenuePhoto');

export function isPhotoModuleAvailable(): boolean {
  return native !== null;
}

export function processPhoto(uri: string): Promise<ProcessedPhoto> {
  if (!native) {
    return Promise.reject(Object.assign(new Error('TenuePhoto native module is not available'), { code: 'ERR_UNAVAILABLE' }));
  }
  return native.processPhoto(uri);
}

export function prepareModels(): Promise<ModelStatus> {
  if (!native) return Promise.resolve('ready');
  return native.prepareModels();
}
