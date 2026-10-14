import { renderHook } from '@testing-library/react-native';

type Listener = (event: { preventDefault(): void }) => void;

const g = globalThis as Record<string, unknown>;
const saved = { window: g.window, document: g.document, navigator: g.navigator };

const windowListeners: Record<string, Listener[]> = {};
const documentListeners: Record<string, (() => void)[]> = {};
const registration = { update: jest.fn(async () => {}), addEventListener: jest.fn(), waiting: null };

function on<T>(store: Record<string, T[]>) {
  return (type: string, listener: T) => {
    (store[type] ??= []).push(listener);
  };
}

g.window = {
  addEventListener: jest.fn(on(windowListeners)),
  matchMedia: () => ({ matches: false }),
  location: { reload: jest.fn() },
};
g.document = { addEventListener: jest.fn(on(documentListeners)), visibilityState: 'hidden' };
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140',
    platform: 'Linux',
    maxTouchPoints: 5,
    serviceWorker: {
      controller: null,
      addEventListener: jest.fn(),
      register: jest.fn(async () => registration),
    },
  },
});

const pwa = require('../pwa.web') as typeof import('../pwa.web');

afterAll(() => {
  g.window = saved.window;
  g.document = saved.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: saved.navigator });
});

describe('pwa on web', () => {
  it('listens for the install prompt as soon as the module loads', () => {
    expect(windowListeners.beforeinstallprompt).toHaveLength(1);
    expect(windowListeners.appinstalled).toHaveLength(1);
  });

  it('keeps a prompt fired before the app starts', async () => {
    const preventDefault = jest.fn();
    windowListeners.beforeinstallprompt![0]!({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    const { result } = await renderHook(() => pwa.usePwa());
    expect(result.current.install).toBe('prompt');
  });

  it('checks for an update when the page becomes visible', async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      pwa.startPwa();
    } finally {
      process.env.NODE_ENV = env;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(documentListeners.visibilitychange).toHaveLength(1);
    documentListeners.visibilitychange![0]!();
    expect(registration.update).not.toHaveBeenCalled();
    (g.document as { visibilityState: string }).visibilityState = 'visible';
    documentListeners.visibilitychange![0]!();
    expect(registration.update).toHaveBeenCalledTimes(1);
  });
});
