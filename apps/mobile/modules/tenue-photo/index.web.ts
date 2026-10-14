import { MEDIAPIPE_BASE } from '../../src/photo/mediapipe';
import { codedError, createBoth, createModelLoader, processPhotoWith } from '../../src/photo/webPipeline';
import type { Decoded, Drawable, PhotoModels, Surface } from '../../src/photo/webPipeline';
import type { ModelStatus, ProcessedPhoto } from './types';

export type { ModelStatus, ProcessedPhoto } from './types';

const BASE = MEDIAPIPE_BASE;
const SEGMENTER_MODEL = `${BASE}/magic_touch.tflite`;
const CLASSIFIER_MODEL = `${BASE}/efficientnet_lite0.tflite`;
const MAX_CLASSES = 5;
const MIN_CLASS_SCORE = 0.05;

type Vision = typeof import('@mediapipe/tasks-vision');

function loadVision(): Promise<Vision> {
  const scope = globalThis as { Vision?: Vision };
  if (scope.Vision) return Promise.resolve(scope.Vision);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${BASE}/vision_bundle.js`;
    script.async = true;
    script.onload = () => (scope.Vision ? resolve(scope.Vision) : reject(new Error('MediaPipe did not load')));
    script.onerror = () => {
      script.remove();
      reject(new TypeError('Cannot load MediaPipe'));
    };
    document.head.appendChild(script);
  });
}

async function loadModels(): Promise<PhotoModels> {
  const { FilesetResolver, ImageClassifier, InteractiveSegmenterLegacy } = await loadVision();
  const fileset = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
  const [segmenter, classifier] = await createBoth(
    InteractiveSegmenterLegacy.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate: 'CPU' },
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    }),
    ImageClassifier.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: CLASSIFIER_MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      maxResults: MAX_CLASSES,
      scoreThreshold: MIN_CLASS_SCORE,
    }),
  );
  return {
    segment(image) {
      const result = segmenter.segment(image as HTMLCanvasElement, { keypoint: { x: 0.5, y: 0.5 } });
      try {
        const mask = result.confidenceMasks?.at(-1);
        if (!mask) throw new Error('Segmenter returned no mask');
        return { width: mask.width, height: mask.height, data: mask.getAsFloat32Array().slice() };
      } finally {
        result.close();
      }
    },
    classify(image) {
      return classifier.classify(image as HTMLCanvasElement).classifications[0]?.categories ?? [];
    },
  };
}

function onIdle(task: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task);
  else setTimeout(task, 1);
}

const models = createModelLoader(loadModels, onIdle);

function createSurface(width: number, height: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is not available');
  return {
    width,
    height,
    image: canvas,
    draw(source: Drawable) {
      context.imageSmoothingQuality = 'high';
      context.drawImage(source as CanvasImageSource, 0, 0, width, height);
    },
    read() {
      return context.getImageData(0, 0, width, height).data;
    },
    write(rgba) {
      const data = context.createImageData(width, height);
      data.data.set(rgba);
      context.putImageData(data, 0, 0);
    },
    encode(type, quality) {
      return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    },
    release() {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

async function decode(blob: Blob): Promise<Decoded> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(blob);
  }
}

async function fetchBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Cannot read ${uri}`);
  return response.blob();
}

export function isPhotoModuleAvailable(): boolean {
  return typeof WebAssembly === 'object' && typeof document !== 'undefined' && typeof createImageBitmap === 'function';
}

export function processPhoto(uri: string): Promise<ProcessedPhoto> {
  if (!isPhotoModuleAvailable()) {
    return Promise.reject(codedError('ERR_UNAVAILABLE', 'Photo processing is not available in this browser'));
  }
  return processPhotoWith(uri, {
    models: models.get,
    fetchBlob,
    decode,
    createSurface,
    objectUrl: (blob) => URL.createObjectURL(blob),
    online: () => navigator.onLine !== false,
  });
}

export function prepareModels(): Promise<ModelStatus> {
  if (!isPhotoModuleAvailable()) return Promise.resolve('ready');
  return Promise.resolve(models.prepare());
}
