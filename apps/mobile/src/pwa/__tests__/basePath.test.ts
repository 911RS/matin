function load(value: string | undefined): typeof import('../basePath') {
  const previous = process.env.EXPO_PUBLIC_BASE_PATH;
  if (value === undefined) delete process.env.EXPO_PUBLIC_BASE_PATH;
  else process.env.EXPO_PUBLIC_BASE_PATH = value;
  let mod: typeof import('../basePath') | undefined;
  jest.isolateModules(() => {
    mod = require('../basePath');
  });
  if (previous === undefined) delete process.env.EXPO_PUBLIC_BASE_PATH;
  else process.env.EXPO_PUBLIC_BASE_PATH = previous;
  return mod!;
}

describe('withBase', () => {
  it('leaves paths alone at the domain root', () => {
    expect(load(undefined).withBase('/sw.js')).toBe('/sw.js');
  });

  it('prefixes the subfolder and drops a trailing slash', () => {
    const { BASE_PATH, withBase } = load('/matin/');
    expect(BASE_PATH).toBe('/matin');
    expect(withBase('/sw.js')).toBe('/matin/sw.js');
  });
});
