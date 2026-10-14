import { installHint, isIos, isStandalone } from '../install';
import type { InstallEnv } from '../install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const base: InstallEnv = {
  displayModeStandalone: false,
  navigatorStandalone: false,
  userAgent: DESKTOP,
  platform: 'Linux x86_64',
  maxTouchPoints: 0,
  hasInstallPrompt: false,
};

describe('isStandalone', () => {
  it('is false in a browser tab', () => {
    expect(isStandalone(base)).toBe(false);
  });

  it('is true for the display-mode media query', () => {
    expect(isStandalone({ ...base, displayModeStandalone: true })).toBe(true);
  });

  it('is true for the iOS navigator flag', () => {
    expect(isStandalone({ ...base, navigatorStandalone: true })).toBe(true);
  });
});

describe('isIos', () => {
  it('detects iPhone', () => {
    expect(isIos({ ...base, userAgent: IPHONE })).toBe(true);
  });

  it('detects iPadOS that reports as a Mac', () => {
    expect(isIos({ ...base, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });

  it('does not treat a real Mac or Linux as iOS', () => {
    expect(isIos({ ...base, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIos(base)).toBe(false);
  });
});

describe('installHint', () => {
  it('shows the Safari steps on iOS outside the installed app', () => {
    expect(installHint({ ...base, userAgent: IPHONE, platform: 'iPhone' })).toBe('ios');
  });

  it('shows nothing once installed', () => {
    expect(installHint({ ...base, userAgent: IPHONE, navigatorStandalone: true })).toBe('none');
    expect(installHint({ ...base, hasInstallPrompt: true, displayModeStandalone: true })).toBe('none');
  });

  it('offers the install prompt when the browser provides one', () => {
    expect(installHint({ ...base, hasInstallPrompt: true })).toBe('prompt');
  });

  it('shows nothing on browsers with no way to install', () => {
    expect(installHint(base)).toBe('none');
  });
});
