import { encodeWebp } from '../webp.web';

interface FakeCanvas {
  width: number;
  height: number;
  drawn: unknown[][];
  types: string[];
  encodedAt: [number, number][];
}

const g = globalThis as Record<string, unknown>;
const saved = { document: g.document, createImageBitmap: g.createImageBitmap, fetch: g.fetch };
let canvases: FakeCanvas[];
let supported: string[];
let close: jest.Mock;
let created: Blob[];

beforeEach(() => {
  canvases = [];
  supported = ['image/webp', 'image/png'];
  close = jest.fn();
  created = [];
  g.fetch = jest.fn(async () => ({ ok: true, blob: async () => new Blob(['png']) }));
  g.createImageBitmap = jest.fn(async () => ({ width: 3000, height: 1500, close }));
  g.document = {
    createElement: () => {
      const canvas: FakeCanvas & Record<string, unknown> = { width: 0, height: 0, drawn: [], types: [], encodedAt: [] };
      canvas.getContext = () => ({ drawImage: (...args: unknown[]) => canvas.drawn.push(args) });
      canvas.toBlob = (done: (blob: Blob | null) => void, type: string, quality?: number) => {
        canvas.types.push(`${type}@${quality ?? '-'}`);
        canvas.encodedAt.push([canvas.width, canvas.height]);
        done(supported.includes(type) ? new Blob(['x'], { type }) : null);
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  URL.createObjectURL = (blob: Blob) => {
    created.push(blob);
    return `blob:webp/${created.length}`;
  };
});

afterAll(() => {
  Object.assign(g, saved);
});

describe('encodeWebp on web', () => {
  it('draws the cut-out at most 1024 on the long side and encodes WebP', async () => {
    await expect(encodeWebp('blob:cutout/1', 3000, 1500)).resolves.toEqual({ uri: 'blob:webp/1', format: 'webp' });
    expect(g.fetch).toHaveBeenCalledWith('blob:cutout/1');
    const canvas = canvases[0]!;
    expect(canvas.encodedAt).toEqual([[1024, 512]]);
    expect(canvas.drawn[0]!.slice(1)).toEqual([0, 0, 1024, 512]);
    expect(canvas.types).toEqual(['image/webp@0.85']);
    expect(created[0]!.type).toBe('image/webp');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps small cut-outs at their size', async () => {
    await encodeWebp('blob:cutout/1', 300, 200);
    expect(canvases[0]!.encodedAt).toEqual([[300, 200]]);
  });

  it('releases the canvas memory after encoding', async () => {
    await encodeWebp('blob:cutout/1', 300, 200);
    expect([canvases[0]!.width, canvases[0]!.height]).toEqual([0, 0]);
  });

  it('releases the canvas and the bitmap when encoding fails', async () => {
    supported = [];
    await expect(encodeWebp('blob:cutout/1', 300, 200)).rejects.toThrow();
    expect([canvases[0]!.width, canvases[0]!.height]).toEqual([0, 0]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('falls back to PNG when the browser cannot encode WebP', async () => {
    supported = ['image/png'];
    await expect(encodeWebp('blob:cutout/1', 300, 200)).resolves.toEqual({ uri: 'blob:webp/1', format: 'png' });
    expect(canvases[0]!.types).toEqual(['image/webp@0.85', 'image/png@-']);
    expect(created[0]!.type).toBe('image/png');
  });

  it('reports PNG when the browser answers a WebP request with a PNG blob', async () => {
    const original = g.document as { createElement: () => Record<string, unknown> };
    g.document = {
      createElement: () => {
        const canvas = original.createElement();
        canvas.toBlob = (done: (blob: Blob | null) => void) => done(new Blob(['x'], { type: 'image/png' }));
        return canvas;
      },
    };
    await expect(encodeWebp('blob:cutout/1', 300, 200)).resolves.toEqual({ uri: 'blob:webp/1', format: 'png' });
  });

  it('rejects when the cut-out cannot be read', async () => {
    g.fetch = jest.fn(async () => ({ ok: false }));
    await expect(encodeWebp('blob:gone', 300, 200)).rejects.toThrow();
  });
});
