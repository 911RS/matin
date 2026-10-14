import { transformFileSync } from '@babel/core';

const CONFIG = (expect.getState().testPath ?? '').replace(/__tests__\/configInline\.test\.ts$/, 'config.ts');

function compiled(env: Record<string, string>): string {
  const saved = { ...process.env };
  Object.assign(process.env, env, { NODE_ENV: 'production', BABEL_ENV: 'production' });
  try {
    const out = transformFileSync(CONFIG, {
      babelrc: false,
      configFile: false,
      presets: [['babel-preset-expo', { reactCompiler: false }]],
      caller: { name: 'metro', bundler: 'metro', platform: 'android', isDev: false } as never,
      filename: CONFIG,
    });
    return out?.code ?? '';
  } finally {
    process.env = saved;
  }
}

describe('config in a release bundle', () => {
  it('inlines every EXPO_PUBLIC variable it reads', () => {
    const code = compiled({
      EXPO_PUBLIC_DEMO: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://inlined.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'inlined-key',
    });
    expect(code).toContain('https://inlined.supabase.co');
    expect(code).toContain('inlined-key');
    expect(code).not.toMatch(/process\.env\.EXPO_PUBLIC/);
  });
});
