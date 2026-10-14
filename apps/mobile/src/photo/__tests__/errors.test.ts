import { errorCode } from '../errors';

describe('errorCode', () => {
  it('reads the code of a coded error', () => {
    expect(errorCode({ code: 'ERR_NO_SUBJECT', message: 'No subject found' })).toBe('ERR_NO_SUBJECT');
  });

  it('falls back to ERR_UNKNOWN for errors without a string code', () => {
    expect(errorCode(new Error('boom'))).toBe('ERR_UNKNOWN');
    expect(errorCode({ code: 42 })).toBe('ERR_UNKNOWN');
    expect(errorCode(null)).toBe('ERR_UNKNOWN');
    expect(errorCode('ERR_NO_SUBJECT')).toBe('ERR_UNKNOWN');
  });
});
