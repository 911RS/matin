export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (path.includes('auth/callback')) return initial ? '/' : null;
  return path;
}
