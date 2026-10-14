import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { colors } from '../../theme';
import { SegmentedControl } from '../SegmentedControl';

const OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
] as const;

describe('SegmentedControl', () => {
  it('is a radiogroup whose selected segment is checked and white', async () => {
    await render(<SegmentedControl options={OPTIONS} value="today" onChange={() => {}} accessibilityLabel="Day" />);
    expect(screen.getByLabelText('Day').props.accessibilityRole).toBe('radiogroup');
    const today = screen.getByRole('radio', { name: 'Today' });
    expect(today.props.accessibilityState).toEqual({ checked: true });
    expect(StyleSheet.flatten(today.props.style).backgroundColor).toBe(colors.surface);
    expect(screen.getByRole('radio', { name: 'Tomorrow' }).props.accessibilityState).toEqual({ checked: false });
  });

  it('reports the tapped key and ignores the current one', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl options={OPTIONS} value="today" onChange={onChange} accessibilityLabel="Day" />);
    fireEvent.press(screen.getByRole('radio', { name: 'Today' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('radio', { name: 'Tomorrow' }));
    expect(onChange).toHaveBeenCalledWith('tomorrow');
  });
});
