import { hasCallbackError } from '../callbackError';

describe('hasCallbackError', () => {
  it('finds an error in the query or the hash', () => {
    expect(hasCallbackError('?error=access_denied', '')).toBe(true);
    expect(hasCallbackError('', '#error_description=Denied')).toBe(true);
    expect(hasCallbackError('?code=abc', '#error=server_error&error_description=x')).toBe(true);
  });

  it('accepts a normal callback', () => {
    expect(hasCallbackError('?code=abc', '')).toBe(false);
    expect(hasCallbackError('', '#access_token=t&refresh_token=r')).toBe(false);
    expect(hasCallbackError('', '')).toBe(false);
  });
});
