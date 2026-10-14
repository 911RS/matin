type Shape = Record<string, string>;

function shape(module: Record<string, unknown>): Shape {
  return Object.fromEntries(
    Object.entries(module)
      .filter(([key]) => key !== '__esModule')
      .map(([key, value]) => [key, typeof value]),
  );
}

describe('web stubs', () => {
  it('files.web exports the same API as the native files adapter', () => {
    const native = jest.requireActual('../data/files') as Record<string, unknown>;
    const web = jest.requireActual('../data/files.web') as Record<string, unknown>;
    expect(shape(web)).toEqual(shape(native));
  });

  it('tenue-photo index.web exports the same API as the native module', () => {
    const native = jest.requireActual('../../modules/tenue-photo/index') as Record<string, unknown>;
    const web = jest.requireActual('../../modules/tenue-photo/index.web') as Record<string, unknown>;
    expect(shape(web)).toEqual(shape(native));
  });

  it('webp.web exports the same API as the native encoder', () => {
    const native = jest.requireActual('../photo/webp') as Record<string, unknown>;
    const web = jest.requireActual('../photo/webp.web') as Record<string, unknown>;
    expect(shape(web)).toEqual(shape(native));
  });

  it('webCss.web exports the same function as the native no-op', () => {
    const native = jest.requireActual('../ui/webCss') as Record<string, unknown>;
    const web = jest.requireActual('../ui/webCss.web') as Record<string, unknown>;
    expect(shape(native)).toEqual({ installWebCss: 'function' });
    expect(shape(web)).toMatchObject(shape(native));
  });

  it('hardwareBack.web exports the same API as the native helper and does nothing', () => {
    const native = jest.requireActual('../ui/hardwareBack') as Record<string, unknown>;
    const web = jest.requireActual('../ui/hardwareBack.web') as typeof import('../ui/hardwareBack.web');
    expect(shape(web as unknown as Record<string, unknown>)).toEqual(shape(native));
    const handler = jest.fn(() => true);
    const remove = web.onHardwareBack(handler);
    remove();
    expect(handler).not.toHaveBeenCalled();
  });

  it('the web photo module reports the unavailable path without browser image APIs', async () => {
    const web = jest.requireActual('../../modules/tenue-photo/index.web') as typeof import('../../modules/tenue-photo/index.web');
    expect(web.isPhotoModuleAvailable()).toBe(false);
    await expect(web.processPhoto('blob:a')).rejects.toMatchObject({ code: 'ERR_UNAVAILABLE' });
    await expect(web.prepareModels()).resolves.toBe('ready');
  });

  it('the web photo module is available when the browser can decode and run wasm', () => {
    const web = jest.requireActual('../../modules/tenue-photo/index.web') as typeof import('../../modules/tenue-photo/index.web');
    const g = globalThis as Record<string, unknown>;
    const saved = { document: g.document, createImageBitmap: g.createImageBitmap };
    g.document = {};
    g.createImageBitmap = () => Promise.resolve();
    try {
      expect(web.isPhotoModuleAvailable()).toBe(true);
    } finally {
      g.document = saved.document;
      g.createImageBitmap = saved.createImageBitmap;
    }
  });
});
