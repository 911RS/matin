import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { colors } from '../../theme';
import { Slot } from '../Slot';

describe('Slot', () => {
  it('draws a rounded dashed box with its label', async () => {
    await render(<Slot label="Top" />);
    expect(screen.getByText('Top')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('slot').props.style)).toEqual(
      expect.objectContaining({ borderStyle: 'dashed', borderColor: colors.line, borderRadius: 14 }),
    );
  });
});
