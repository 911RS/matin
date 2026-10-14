import { fireEvent, render, screen } from '@testing-library/react-native';
import SignIn from '../../../app/sign-in';
import { initI18n } from '../../i18n';
import { startGuest } from '../guest';

jest.mock('../guest', () => ({ startGuest: jest.fn(async () => {}) }));
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'matin://auth/callback') }));
let mockParams: { error?: string } = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

beforeAll(() => {
  initI18n();
});

describe('sign-in screen', () => {
  it('starts guest mode from the continue-without-account button', async () => {
    await render(<SignIn />);
    fireEvent.press(screen.getByLabelText('Continue without an account'));
    expect(startGuest).toHaveBeenCalledTimes(1);
  });

  it('shows an inline message when the OAuth callback failed', async () => {
    mockParams = { error: 'callback' };
    try {
      await render(<SignIn />);
      expect(screen.getByText('Google sign-in did not go through. Try again.')).toBeTruthy();
    } finally {
      mockParams = {};
    }
  });

  it('shows no message by default', async () => {
    await render(<SignIn />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
