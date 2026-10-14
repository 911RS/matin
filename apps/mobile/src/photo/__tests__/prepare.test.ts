import { File } from 'expo-file-system';
import { fitLongSide, preparePhoto } from '../prepare';

jest.mock('../../../modules/tenue-photo', () => ({ processPhoto: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { WEBP: 'webp' },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

const processed = {
  cutoutUri: 'file:///cache/cutout.png',
  width: 2000,
  height: 1000,
  dominantColor: '#1b2a4a',
  labels: ['Jeans'],
};

describe('preparePhoto', () => {
  it('converts the cutout to webp and maps tags', async () => {
    const process = jest.fn().mockResolvedValue(processed);
    const toWebp = jest.fn().mockResolvedValue({ uri: 'file:///cache/cutout.webp', format: 'webp' });
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const result = await preparePhoto('file:///orig.jpg', { process, toWebp, deleteFile });
    expect(process).toHaveBeenCalledWith('file:///orig.jpg');
    expect(toWebp).toHaveBeenCalledWith('file:///cache/cutout.png', 2000, 1000);
    expect(result).toEqual({
      cutoutUri: 'file:///cache/cutout.webp',
      cutoutFormat: 'webp',
      originalUri: 'file:///orig.jpg',
      tags: { category: 'bottom', colorFamily: 'navy', colorHex: '#1b2a4a' },
    });
    expect(deleteFile).toHaveBeenCalledWith('file:///cache/cutout.png');
  });

  it('reports a png cutout when the encoder fell back to png', async () => {
    const process = jest.fn().mockResolvedValue(processed);
    const toWebp = jest.fn().mockResolvedValue({ uri: 'blob:cutout/2', format: 'png' });
    const result = await preparePhoto('file:///orig.jpg', { process, toWebp, deleteFile: jest.fn().mockResolvedValue(undefined) });
    expect(result.cutoutUri).toBe('blob:cutout/2');
    expect(result.cutoutFormat).toBe('png');
  });

  it('deletes the png cutout when webp conversion fails', async () => {
    const process = jest.fn().mockResolvedValue(processed);
    const toWebp = jest.fn().mockRejectedValue(new Error('encode failed'));
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    await expect(preparePhoto('file:///orig.jpg', { process, toWebp, deleteFile })).rejects.toThrow(
      'encode failed',
    );
    expect(deleteFile).toHaveBeenCalledWith('file:///cache/cutout.png');
  });

  it('ignores errors while deleting the png cutout', async () => {
    const process = jest.fn().mockResolvedValue(processed);
    const toWebp = jest.fn().mockResolvedValue({ uri: 'file:///cache/cutout.webp', format: 'webp' });
    const deleteFile = jest.fn().mockRejectedValue(new Error('gone'));
    const result = await preparePhoto('file:///orig.jpg', { process, toWebp, deleteFile });
    expect(result.cutoutUri).toBe('file:///cache/cutout.webp');
  });

  it('deletes the png cutout with expo-file-system by default', async () => {
    const remove = jest.fn();
    jest.mocked(File).mockImplementation(() => ({ exists: true, delete: remove }) as unknown as File);
    const process = jest.fn().mockResolvedValue(processed);
    const toWebp = jest.fn().mockResolvedValue({ uri: 'file:///cache/cutout.webp', format: 'webp' });
    await preparePhoto('file:///orig.jpg', { process, toWebp });
    expect(File).toHaveBeenCalledWith('file:///cache/cutout.png');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('propagates process errors unchanged', async () => {
    const process = jest.fn().mockRejectedValue({ code: 'ERR_NO_SUBJECT' });
    const toWebp = jest.fn();
    const deleteFile = jest.fn();
    await expect(preparePhoto('file:///orig.jpg', { process, toWebp, deleteFile })).rejects.toMatchObject({
      code: 'ERR_NO_SUBJECT',
    });
    expect(toWebp).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
  });
});

describe('fitLongSide', () => {
  it('scales the longer side down to the limit', () => {
    expect(fitLongSide(2000, 1000, 1024)).toEqual({ width: 1024 });
    expect(fitLongSide(1000, 3000, 1024)).toEqual({ height: 1024 });
  });

  it('never upscales', () => {
    expect(fitLongSide(800, 600, 1024)).toBeNull();
    expect(fitLongSide(1024, 1024, 1024)).toBeNull();
  });
});
