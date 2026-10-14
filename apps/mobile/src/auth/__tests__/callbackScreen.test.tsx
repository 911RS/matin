import { act, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AuthCallback from '../../../app/auth/callback';
import { initI18n } from '../../i18n';
import { getSupabase } from '../../lib/supabase';
import { waitForSession } from '../waitForSession';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn(() => ({})) }));
jest.mock('../waitForSession', () => ({ waitForSession: jest.fn() }));

const g = globalThis as { location?: unknown };
const os = Platform.OS;
const savedLocation = g.location;

function setLocation(search: string, hash = '') {
  g.location = { search, hash };
}

beforeAll(() => {
  initI18n();
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  g.location = savedLocation;
});

beforeEach(() => {
  mockReplace.mockClear();
  (getSupabase as jest.Mock).mockReset().mockReturnValue({});
  (waitForSession as jest.Mock).mockReset();
  setLocation('?code=abc');
});

describe('OAuth callback screen', () => {
  it('goes home once the session is ready', async () => {
    (waitForSession as jest.Mock).mockResolvedValue({ access_token: 't' });
    await render(<AuthCallback />);
    await act(async () => {});
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('returns to sign-in with a message when the provider sent an error', async () => {
    setLocation('?error=access_denied&error_description=Denied');
    await render(<AuthCallback />);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { error: 'callback' } });
    expect(waitForSession).not.toHaveBeenCalled();
  });

  it('returns to sign-in when Supabase is not configured', async () => {
    (getSupabase as jest.Mock).mockImplementation(() => {
      throw new Error('missing env');
    });
    await render(<AuthCallback />);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { error: 'callback' } });
  });

  it('explains a timeout and offers a way back', async () => {
    (waitForSession as jest.Mock).mockResolvedValue(null);
    await render(<AuthCallback />);
    await act(async () => {});
    expect(screen.getByText('Signing in is taking too long. Check your connection and try again.')).toBeTruthy();
    expect(screen.getByText('Back to sign-in')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
