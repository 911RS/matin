import { createBoth, createModelLoader, isNetworkFailure, processPhotoWith } from '../webPipeline';
import type { Drawable, Mask, PhotoModels, PipelineDeps, Surface } from '../webPipeline';

type Pixel = [number, number, number, number];

interface Raster extends Drawable {
  data: Uint8ClampedArray;
}

function raster(width: number, height: number, pixel: (x: number, y: number) => Pixel): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
}

class FakeSurface implements Surface {
  data: Uint8ClampedArray;
  readonly image = this;
  encodedAs: string[] = [];
  released = false;
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly encodeResult: (type: string) => Blob | null,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
  draw(source: Drawable): void {
    const src = source as Raster;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const sx = Math.floor((x * src.width) / this.width);
        const sy = Math.floor((y * src.height) / this.height);
        const from = (sy * src.width + sx) * 4;
        this.data.set(src.data.subarray(from, from + 4), (y * this.width + x) * 4);
      }
    }
  }
  read(): Uint8ClampedArray {
    return this.data.slice();
  }
  write(rgba: Uint8ClampedArray): void {
    this.data = rgba.slice();
  }
  release(): void {
    this.released = true;
  }
  encode(type: string): Promise<Blob | null> {
    this.encodedAs.push(type);
    return Promise.resolve(this.encodeResult(type));
  }
}

const RED: Pixel = [0xf0, 0x10, 0x10, 255];
const GREY: Pixel = [0x80, 0x80, 0x80, 255];

function centerSquare(x: number, y: number): boolean {
  return x >= 1 && x <= 2 && y >= 1 && y <= 2;
}

function maskOf(width: number, height: number, value: (x: number, y: number) => number): Mask {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = value(x, y);
  return { width, height, data };
}

function setup(options: {
  image?: Raster;
  mask?: Mask;
  models?: () => Promise<PhotoModels>;
  classify?: PhotoModels['classify'];
  segment?: PhotoModels['segment'];
  fetchBlob?: PipelineDeps['fetchBlob'];
  encode?: (type: string) => Blob | null;
} = {}) {
  const image = options.image ?? raster(4, 4, (x, y) => (centerSquare(x, y) ? RED : GREY));
  const mask = options.mask ?? maskOf(4, 4, (x, y) => (centerSquare(x, y) ? 0.9 : 0.1));
  const close = jest.fn();
  const surfaces: FakeSurface[] = [];
  const segment = jest.fn(options.segment ?? (() => mask));
  const classify = jest.fn(options.classify ?? (() => [{ categoryName: 'jean', score: 0.7 }]));
  const models = jest.fn(options.models ?? (async () => ({ segment, classify })));
  const fetchBlob = jest.fn(options.fetchBlob ?? (async () => new Blob(['jpeg'])));
  const urls: Blob[] = [];
  const deps: PipelineDeps = {
    models,
    fetchBlob,
    decode: jest.fn(async () => ({ ...image, close })),
    createSurface: (width, height) => {
      const surface = new FakeSurface(width, height, options.encode ?? ((type) => new Blob(['png'], { type })));
      surfaces.push(surface);
      return surface;
    },
    objectUrl: (blob) => {
      urls.push(blob);
      return `blob:out/${urls.length}`;
    },
  };
  return { deps, close, surfaces, segment, classify, models, fetchBlob, urls };
}

describe('processPhotoWith', () => {
  it('cuts out the subject under the center keypoint and tags it', async () => {
    const t = setup();
    const result = await processPhotoWith('blob:picked/1', t.deps);
    expect(result).toEqual({
      cutoutUri: 'blob:out/1',
      width: 2,
      height: 2,
      dominantColor: '#f01010',
      labels: ['Jeans'],
    });
    expect(t.fetchBlob).toHaveBeenCalledWith('blob:picked/1');
    expect(t.close).toHaveBeenCalledTimes(1);
    expect(t.segment).toHaveBeenCalledWith(t.surfaces[0]);
    expect(t.classify).toHaveBeenCalledWith(t.surfaces[0]);
    const cutout = t.surfaces[1]!;
    expect(cutout.encodedAs).toEqual(['image/png']);
    expect(Array.from(cutout.data)).toEqual([...RED, ...RED, ...RED, ...RED]);
    expect(t.urls[0]!.type).toBe('image/png');
  });

  it('releases every surface after a cut-out', async () => {
    const t = setup({ image: raster(600, 10, () => RED), mask: maskOf(1, 1, () => 1) });
    await processPhotoWith('blob:a', t.deps);
    expect(t.surfaces).toHaveLength(3);
    expect(t.surfaces.every((surface) => surface.released)).toBe(true);
  });

  it('releases every surface when processing fails', async () => {
    const t = setup({ encode: () => null });
    await expect(processPhotoWith('blob:a', t.deps)).rejects.toMatchObject({ code: 'ERR_PROCESS' });
    expect(t.surfaces.length).toBeGreaterThan(0);
    expect(t.surfaces.every((surface) => surface.released)).toBe(true);
  });

  it('makes everything outside the mask transparent inside the crop', async () => {
    const mask = maskOf(4, 4, (x, y) => (x === 1 && y === 1) || (x === 2 && y === 2) ? 1 : 0);
    const t = setup({ mask });
    const result = await processPhotoWith('blob:a', t.deps);
    expect([result.width, result.height]).toEqual([2, 2]);
    const alpha = Array.from(t.surfaces[1]!.data).filter((_, i) => i % 4 === 3);
    expect(alpha).toEqual([255, 0, 0, 255]);
  });

  it('keeps the side of the mask that holds the keypoint', async () => {
    const t = setup({ mask: maskOf(4, 4, (x, y) => (centerSquare(x, y) ? 0.1 : 0.9)) });
    const result = await processPhotoWith('blob:a', t.deps);
    expect([result.width, result.height, result.dominantColor]).toEqual([2, 2, '#f01010']);
  });

  it('scales a smaller mask to the image', async () => {
    const image = raster(4, 4, (x) => (x < 2 ? RED : GREY));
    const t = setup({ image, mask: maskOf(2, 2, (x) => (x === 1 ? 1 : 0)) });
    const result = await processPhotoWith('blob:a', t.deps);
    expect([result.width, result.height, result.dominantColor]).toEqual([2, 4, '#808080']);
  });

  it('decodes at most 2048 on the long side', async () => {
    const image = raster(4000, 10, () => RED);
    const t = setup({ image, mask: maskOf(1, 1, () => 1) });
    await processPhotoWith('blob:a', t.deps);
    expect([t.surfaces[0]!.width, t.surfaces[0]!.height]).toEqual([2000, 5]);
  });

  it('samples the colour on a cut-out of at most 512 pixels', async () => {
    const image = raster(600, 10, () => RED);
    const t = setup({ image, mask: maskOf(1, 1, () => 1) });
    const result = await processPhotoWith('blob:a', t.deps);
    expect([result.width, result.height]).toEqual([600, 10]);
    expect([t.surfaces[2]!.width, t.surfaces[2]!.height]).toEqual([512, 9]);
    expect(result.dominantColor).toBe('#f01010');
  });

  it('rejects with ERR_NO_SUBJECT when nothing opaque is left', async () => {
    const t = setup({ image: raster(4, 4, () => [0, 0, 0, 0]) });
    await expect(processPhotoWith('blob:a', t.deps)).rejects.toMatchObject({ code: 'ERR_NO_SUBJECT' });
    expect(t.urls).toEqual([]);
  });

  it('rejects with ERR_MODEL_DOWNLOADING when a network failure stops the models', async () => {
    const t = setup({ models: () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(processPhotoWith('blob:a', t.deps)).rejects.toMatchObject({ code: 'ERR_MODEL_DOWNLOADING' });
    expect(t.fetchBlob).not.toHaveBeenCalled();
  });

  it('rejects with ERR_MODEL_DOWNLOADING for any model failure while offline', async () => {
    const t = setup({ models: () => Promise.reject(new Error('404')) });
    t.deps.online = () => false;
    await expect(processPhotoWith('blob:a', t.deps)).rejects.toMatchObject({ code: 'ERR_MODEL_DOWNLOADING' });
  });

  it('rejects with ERR_UNAVAILABLE when the models fail for another reason', async () => {
    const t = setup({ models: () => Promise.reject(new Error('WebAssembly.instantiate failed')) });
    t.deps.online = () => true;
    await expect(processPhotoWith('blob:a', t.deps)).rejects.toMatchObject({ code: 'ERR_UNAVAILABLE' });
    expect(t.fetchBlob).not.toHaveBeenCalled();
  });

  it('rejects with ERR_PROCESS for other failures', async () => {
    const segmentFails = setup({
      segment: () => {
        throw new Error('wasm abort');
      },
    });
    await expect(processPhotoWith('blob:a', segmentFails.deps)).rejects.toMatchObject({
      code: 'ERR_PROCESS',
      message: 'wasm abort',
    });
    const fetchFails = setup({ fetchBlob: () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(processPhotoWith('blob:a', fetchFails.deps)).rejects.toMatchObject({ code: 'ERR_PROCESS' });
    const encodeFails = setup({ encode: () => null });
    await expect(processPhotoWith('blob:a', encodeFails.deps)).rejects.toMatchObject({ code: 'ERR_PROCESS' });
  });

  it('still returns the cut-out when the classifier fails', async () => {
    const t = setup({
      classify: () => {
        throw new Error('classifier');
      },
    });
    await expect(processPhotoWith('blob:a', t.deps)).resolves.toMatchObject({ labels: [], width: 2 });
  });
});

describe('isNetworkFailure', () => {
  it('treats a fetch TypeError or being offline as a network failure', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(isNetworkFailure(new Error('abort'), false)).toBe(true);
    expect(isNetworkFailure(new Error('abort'), true)).toBe(false);
    expect(isNetworkFailure('boom', true)).toBe(false);
  });
});

describe('createBoth', () => {
  const task = () => ({ close: jest.fn() });

  it('returns both tasks when both load', async () => {
    const a = task();
    const b = task();
    await expect(createBoth(Promise.resolve(a), Promise.resolve(b))).resolves.toEqual([a, b]);
    expect(a.close).not.toHaveBeenCalled();
  });

  it('closes the first task when the second fails', async () => {
    const a = task();
    await expect(createBoth(Promise.resolve(a), Promise.reject(new TypeError('model')))).rejects.toThrow('model');
    expect(a.close).toHaveBeenCalledTimes(1);
  });

  it('closes the second task when the first fails', async () => {
    const b = task();
    await expect(createBoth(Promise.reject(new Error('wasm')), Promise.resolve(b))).rejects.toThrow('wasm');
    expect(b.close).toHaveBeenCalledTimes(1);
  });
});

describe('createModelLoader', () => {
  it('loads once for concurrent callers', async () => {
    const load = jest.fn(async () => 'models');
    const loader = createModelLoader(load, () => {});
    await expect(Promise.all([loader.get(), loader.get()])).resolves.toEqual(['models', 'models']);
    await loader.get();
    expect(load).toHaveBeenCalledTimes(1);
    expect(loader.isLoaded()).toBe(true);
  });

  it('tries again after a failed load', async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('models');
    const loader = createModelLoader(load, () => {});
    await expect(loader.get()).rejects.toThrow('offline');
    expect(loader.isLoaded()).toBe(false);
    await expect(loader.get()).resolves.toBe('models');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('warms the models once when idle and then reports ready', async () => {
    const load = jest.fn(async () => 'models');
    const idle: (() => void)[] = [];
    const loader = createModelLoader(load, (task) => idle.push(task));
    expect(loader.prepare()).toBe('downloading');
    expect(loader.prepare()).toBe('downloading');
    expect(idle).toHaveLength(1);
    expect(load).not.toHaveBeenCalled();
    idle[0]!();
    await loader.get();
    expect(load).toHaveBeenCalledTimes(1);
    expect(loader.prepare()).toBe('ready');
  });

  it('swallows a failed warm-up', async () => {
    const load = jest.fn().mockRejectedValue(new Error('offline'));
    const idle: (() => void)[] = [];
    const loader = createModelLoader(load, (task) => idle.push(task));
    loader.prepare();
    idle[0]!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loader.prepare()).toBe('downloading');
    expect(idle).toHaveLength(2);
  });
});
