import type { ModelStatus, ProcessedPhoto } from '../../modules/tenue-photo/types';
import { imagenetToLabels } from './imagenetLabels';
import type { ImagenetCategory } from './imagenetLabels';
import { argbFromRgba, colorHex, dominantColor, opaqueBounds, sampleSize } from './pixelOps';

const MAX_DECODE_SIDE = 2048;
const COLOR_SIDE = 512;
const MASK_THRESHOLD = 0.5;

export interface Drawable {
  readonly width: number;
  readonly height: number;
}

export interface Decoded extends Drawable {
  close?(): void;
}

export interface Surface extends Drawable {
  readonly image: Drawable;
  draw(source: Drawable): void;
  read(): Uint8ClampedArray;
  write(rgba: Uint8ClampedArray): void;
  encode(type: string, quality?: number): Promise<Blob | null>;
  release(): void;
}

export interface Mask {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export interface PhotoModels {
  segment(image: Drawable): Mask;
  classify(image: Drawable): ImagenetCategory[];
}

export interface PipelineDeps {
  models(): Promise<PhotoModels>;
  fetchBlob(uri: string): Promise<Blob>;
  decode(blob: Blob): Promise<Decoded>;
  createSurface(width: number, height: number): Surface;
  objectUrl(blob: Blob): string;
  online?(): boolean;
}

type CodedError = Error & { code: string };

export function codedError(code: string, message: string): CodedError {
  return Object.assign(new Error(message), { code });
}

export function isNetworkFailure(error: unknown, online: boolean): boolean {
  return !online || error instanceof TypeError;
}

function isNoSubject(error: unknown): boolean {
  return error instanceof Error && (error as Partial<CodedError>).code === 'ERR_NO_SUBJECT';
}

function maskAt(mask: Mask, x: number, y: number, width: number, height: number): number {
  const mx = Math.min(mask.width - 1, Math.floor((x * mask.width) / width));
  const my = Math.min(mask.height - 1, Math.floor((y * mask.height) / height));
  return mask.data[my * mask.width + mx] ?? 0;
}

export function applyMask(rgba: Uint8ClampedArray, width: number, height: number, mask: Mask): void {
  // The keypoint sits on the subject, so the center decides which side of the mask is foreground.
  const centerIsHigh = maskAt(mask, Math.floor(width / 2), Math.floor(height / 2), width, height) >= MASK_THRESHOLD;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const high = maskAt(mask, x, y, width, height) >= MASK_THRESHOLD;
      if (high !== centerIsHigh) rgba[(y * width + x) * 4 + 3] = 0;
    }
  }
}

function crop(rgba: Uint8ClampedArray, width: number, box: [number, number, number, number]): Uint8ClampedArray {
  const [left, top, right, bottom] = box;
  const w = right - left;
  const out = new Uint8ClampedArray(w * (bottom - top) * 4);
  for (let y = top; y < bottom; y++) {
    const from = (y * width + left) * 4;
    out.set(rgba.subarray(from, from + w * 4), (y - top) * w * 4);
  }
  return out;
}

type MakeSurface = PipelineDeps['createSurface'];

function colorOf(cutout: Surface, rgba: Uint8ClampedArray, make: MakeSurface): number | null {
  const scale = Math.min(1, COLOR_SIDE / Math.max(cutout.width, cutout.height));
  if (scale >= 1) return dominantColor(argbFromRgba(rgba));
  const small = make(
    Math.max(1, Math.round(cutout.width * scale)),
    Math.max(1, Math.round(cutout.height * scale)),
  );
  small.draw(cutout.image);
  return dominantColor(argbFromRgba(small.read()));
}

async function run(uri: string, models: PhotoModels, deps: PipelineDeps): Promise<ProcessedPhoto> {
  const surfaces: Surface[] = [];
  const make: MakeSurface = (width, height) => {
    const surface = deps.createSurface(width, height);
    surfaces.push(surface);
    return surface;
  };
  try {
    return await cutOut(uri, models, deps, make);
  } finally {
    for (const surface of surfaces) surface.release();
  }
}

async function cutOut(uri: string, models: PhotoModels, deps: PipelineDeps, make: MakeSurface): Promise<ProcessedPhoto> {
  const decoded = await deps.decode(await deps.fetchBlob(uri));
  let source: Surface;
  try {
    const s = sampleSize(decoded.width, decoded.height, MAX_DECODE_SIDE);
    source = make(Math.max(1, Math.floor(decoded.width / s)), Math.max(1, Math.floor(decoded.height / s)));
    source.draw(decoded);
  } finally {
    decoded.close?.();
  }
  const { width, height } = source;
  const rgba = source.read();
  const mask = models.segment(source.image);
  let labels: string[];
  try {
    labels = imagenetToLabels(models.classify(source.image));
  } catch {
    labels = [];
  }
  applyMask(rgba, width, height, mask);
  const box = opaqueBounds(argbFromRgba(rgba), width, height);
  if (!box) throw codedError('ERR_NO_SUBJECT', 'No subject found');
  const cropped = crop(rgba, width, box);
  const cutout = make(box[2] - box[0], box[3] - box[1]);
  cutout.write(cropped);
  const color = colorOf(cutout, cropped, make);
  if (color === null) throw codedError('ERR_NO_SUBJECT', 'No subject found');
  const png = await cutout.encode('image/png');
  if (!png) throw new Error('Cannot encode PNG');
  return {
    cutoutUri: deps.objectUrl(png),
    width: cutout.width,
    height: cutout.height,
    dominantColor: colorHex(color),
    labels,
  };
}

export async function processPhotoWith(uri: string, deps: PipelineDeps): Promise<ProcessedPhoto> {
  let models: PhotoModels;
  try {
    models = await deps.models();
  } catch (error) {
    if (isNetworkFailure(error, deps.online?.() ?? true)) {
      throw codedError('ERR_MODEL_DOWNLOADING', `Model not ready: ${String(error)}`);
    }
    throw codedError('ERR_UNAVAILABLE', `Models cannot run here: ${String(error)}`);
  }
  try {
    return await run(uri, models, deps);
  } catch (error) {
    if (isNoSubject(error)) throw error;
    throw codedError('ERR_PROCESS', error instanceof Error ? error.message : String(error));
  }
}

export interface Closable {
  close(): void;
}

function closeQuietly(task: Closable): void {
  try {
    task.close();
  } catch {}
}

export async function createBoth<A extends Closable, B extends Closable>(a: Promise<A>, b: Promise<B>): Promise<[A, B]> {
  const [first, second] = await Promise.allSettled([a, b]);
  if (first.status === 'fulfilled' && second.status === 'fulfilled') return [first.value, second.value];
  if (first.status === 'fulfilled') closeQuietly(first.value);
  if (second.status === 'fulfilled') closeQuietly(second.value);
  throw first.status === 'rejected' ? first.reason : (second as PromiseRejectedResult).reason;
}

export interface ModelLoader<T> {
  get(): Promise<T>;
  isLoaded(): boolean;
  prepare(): ModelStatus;
}

export function createModelLoader<T>(load: () => Promise<T>, onIdle: (task: () => void) => void): ModelLoader<T> {
  let pending: Promise<T> | null = null;
  let loaded = false;
  let scheduled = false;
  const get = (): Promise<T> => {
    pending ??= load().then(
      (value) => {
        loaded = true;
        return value;
      },
      (error: unknown) => {
        pending = null;
        throw error;
      },
    );
    return pending;
  };
  return {
    get,
    isLoaded: () => loaded,
    prepare() {
      if (loaded) return 'ready';
      if (!scheduled) {
        scheduled = true;
        onIdle(() => {
          scheduled = false;
          get().catch(() => {});
        });
      }
      return 'downloading';
    },
  };
}
