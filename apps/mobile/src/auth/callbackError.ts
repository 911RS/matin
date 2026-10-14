export function hasCallbackError(search: string, hash: string): boolean {
  for (const part of [search, hash]) {
    const params = new URLSearchParams(part.replace(/^[?#]/, ''));
    if (params.has('error') || params.has('error_description')) return true;
  }
  return false;
}
