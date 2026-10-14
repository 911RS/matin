import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { colors } from '../../theme';
import { Field } from '../Field';

describe('Field', () => {
  it('stays visible on white sheets and on paper', async () => {
    await render(<Field label="City" nativeID="city" />);
    const style = StyleSheet.flatten(screen.getByLabelText('City').props.style);
    expect(style.backgroundColor).toBe(colors.tile);
    expect(style.borderColor).toBe(colors.line);
  });
});
