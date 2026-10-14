import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { initI18n } from '../../i18n';
import { LocationSheet, SEARCH_COOLDOWN_MS } from '../LocationSheet';
import type { LocationDeps } from '../location';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../deviceLocation', () => ({ gpsDeps: {}, cityDeps: {}, placeName: jest.fn() }));

beforeAll(() => initI18n('en'));

function deps(geocode: LocationDeps['geocode']) {
  const city: LocationDeps = {
    requestPermission: async () => false,
    getCurrentPosition: async () => ({ lat: 0, lon: 0 }),
    geocode,
  };
  return { gps: city, city, placeName: async () => null };
}

describe('LocationSheet city search', () => {
  it('keeps Search disabled for a second after each request', async () => {
    const geocode = jest.fn(async () => null);
    await render(<LocationSheet visible onSaved={jest.fn()} onClose={jest.fn()} deps={deps(geocode)} />);
    await fireEvent.changeText(screen.getByLabelText('City'), 'Nowhere');
    const button = () => screen.getByRole('button', { name: 'Search' });
    await act(async () => {
      fireEvent.press(button());
    });
    await waitFor(() => expect(geocode).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(button().props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => {
      fireEvent.press(button());
      fireEvent(screen.getByLabelText('City'), 'submitEditing');
    });
    expect(geocode).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button().props.accessibilityState).toMatchObject({ disabled: false }), {
      timeout: SEARCH_COOLDOWN_MS + 1000,
    });
    await act(async () => {
      fireEvent.press(button());
    });
    await waitFor(() => expect(geocode).toHaveBeenCalledTimes(2));
  });
});
