import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { colors } from '../../theme';
import { Button } from '../Button';

describe('Button', () => {
  it('fires onPress when enabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not pressable when disabled and reports it', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });

  it('is busy and not pressable while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
  });

  it('is blocked without the disabled look while another action runs', async () => {
    const onPress = jest.fn();
    await render(<Button label="Email" variant="secondary" onPress={onPress} blocked />);
    const button = screen.getByRole('button', { name: 'Email' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(StyleSheet.flatten(button.props.style)).toEqual(
      expect.objectContaining({ opacity: 0.5, backgroundColor: colors.surface }),
    );
  });

  it('uses a separate accessibility label when given', async () => {
    await render(<Button label="Save" accessibilityLabel="Save piece" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save piece' })).toBeTruthy();
  });

  it('fills the danger variant with the danger color', async () => {
    await render(<Button label="Archive" variant="danger" onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Archive' });
    expect(StyleSheet.flatten(button.props.style)).toEqual(
      expect.objectContaining({ backgroundColor: colors.danger, height: 52 }),
    );
  });
});
