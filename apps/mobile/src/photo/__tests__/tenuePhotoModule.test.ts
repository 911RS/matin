type Module = typeof import('../../../modules/tenue-photo');

function load(native: unknown): Module {
  let loaded: Module | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => native) }));
    loaded = require('../../../modules/tenue-photo') as Module;
  });
  if (!loaded) throw new Error('module not loaded');
  return loaded;
}

afterEach(() => {
  jest.dontMock('expo');
});

describe('tenue-photo module', () => {
  it('degrades when the native module is missing (Expo Go)', async () => {
    const photo = load(null);
    expect(photo.isPhotoModuleAvailable()).toBe(false);
    await expect(photo.processPhoto('file:///a.jpg')).rejects.toMatchObject({ code: 'ERR_UNAVAILABLE' });
    await expect(photo.prepareModels()).resolves.toBe('ready');
  });

  it('calls the native module when it is present', async () => {
    const result = { cutoutUri: 'file:///c.png', width: 1, height: 1, dominantColor: '#000000', labels: [] };
    const native = {
      processPhoto: jest.fn().mockResolvedValue(result),
      prepareModels: jest.fn().mockResolvedValue('downloading'),
    };
    const photo = load(native);
    expect(photo.isPhotoModuleAvailable()).toBe(true);
    await expect(photo.processPhoto('file:///a.jpg')).resolves.toBe(result);
    await expect(photo.prepareModels()).resolves.toBe('downloading');
    expect(native.processPhoto).toHaveBeenCalledWith('file:///a.jpg');
  });
});
