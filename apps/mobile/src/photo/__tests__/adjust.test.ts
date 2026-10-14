import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { adjustImage } from '../adjust';

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { PNG: 'png', JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

const manipulate = ImageManipulator.manipulate as jest.Mock;
let ops: unknown[][];

beforeEach(() => {
  ops = [];
  manipulate.mockImplementation(() => {
    const context = {
      rotate: (deg: number) => (ops.push(['rotate', deg]), context),
      crop: (rect: unknown) => (ops.push(['crop', rect]), context),
      renderAsync: async () => ({
        width: 1000,
        height: 500,
        saveAsync: async (options: { format: string }) => {
          ops.push(['save', options.format]);
          return { uri: `file:///cache/out.${options.format}`, width: 500, height: 1000 };
        },
      }),
    };
    return context;
  });
});

describe('adjustImage (native)', () => {
  it('turns the image a quarter clockwise', async () => {
    const out = await adjustImage('file:///cut.webp', { kind: 'rotate' }, 'png');
    expect(ops).toContainEqual(['rotate', 90]);
    expect(ops).toContainEqual(['save', SaveFormat.PNG]);
    expect(out).toEqual({ uri: 'file:///cache/out.png', width: 500, height: 1000 });
  });

  it('crops the frame in pixels of the current image', async () => {
    await adjustImage('file:///orig.jpg', { kind: 'crop', crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 } }, 'jpeg');
    expect(ops).toContainEqual(['crop', { originX: 100, originY: 100, width: 500, height: 250 }]);
    expect(ops).toContainEqual(['save', SaveFormat.JPEG]);
  });
});
