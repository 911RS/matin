import { adjustImage } from '../adjust.web';

const g = globalThis as Record<string, unknown>;
const saved = { document: g.document, createImageBitmap: g.createImageBitmap, fetch: g.fetch };
let calls: unknown[][];
let canvas: Record<string, unknown> & { width: number; height: number };

beforeEach(() => {
  calls = [];
  g.fetch = jest.fn(async () => ({ ok: true, blob: async () => new Blob(['img']) }));
  g.createImageBitmap = jest.fn(async () => ({ width: 1000, height: 500, close: () => calls.push(['close']) }));
  g.document = {
    createElement: () => {
      canvas = { width: 0, height: 0 };
      canvas.getContext = () => ({
        translate: (...a: unknown[]) => calls.push(['translate', ...a]),
        rotate: (...a: unknown[]) => calls.push(['rotate', ...a]),
        drawImage: (...a: unknown[]) => calls.push(['draw', ...a.slice(1)]),
      });
      canvas.toBlob = (done: (b: Blob) => void, type: string) => {
        calls.push(['encode', type, canvas.width, canvas.height]);
        done(new Blob(['x'], { type }));
      };
      return canvas;
    },
  };
  URL.createObjectURL = () => 'blob:adjusted/1';
});

afterAll(() => {
  Object.assign(g, saved);
});

describe('adjustImage (web)', () => {
  it('rotates onto a canvas with swapped sides and keeps PNG transparency', async () => {
    const out = await adjustImage('blob:cut', { kind: 'rotate' }, 'png');
    expect(calls).toContainEqual(['translate', 500, 0]);
    expect(calls).toContainEqual(['rotate', Math.PI / 2]);
    expect(calls).toContainEqual(['encode', 'image/png', 500, 1000]);
    expect(out).toEqual({ uri: 'blob:adjusted/1', width: 500, height: 1000 });
    expect(calls).toContainEqual(['close']);
  });

  it('copies only the cropped pixels and encodes JPEG for photos', async () => {
    const out = await adjustImage('blob:orig', { kind: 'crop', crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 } }, 'jpeg');
    expect(calls).toContainEqual(['draw', 100, 100, 500, 250, 0, 0, 500, 250]);
    expect(calls).toContainEqual(['encode', 'image/jpeg', 500, 250]);
    expect(out).toMatchObject({ width: 500, height: 250 });
  });
});
