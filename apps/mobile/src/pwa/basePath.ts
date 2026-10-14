// Path prefix when the web build is served from a subfolder, e.g. "/matin" on GitHub Pages. Empty at the domain root.
export const BASE_PATH = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
