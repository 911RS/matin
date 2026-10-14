import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ColorFamily } from '@tenue/engine';
import { colors, multiSwatch, swatch } from '../../theme';
import { ColorDot } from '../ColorDot';

const FAMILIES: ColorFamily[] = [
  'black', 'white', 'grey', 'navy', 'blue', 'beige', 'brown',
  'green', 'red', 'pink', 'yellow', 'purple', 'denim', 'multi',
];

function fills(testID: string): string[] {
  return screen
    .getAllByTestId(testID)
    .map((node) => StyleSheet.flatten(node.props.style).backgroundColor as string);
}

describe('ColorDot', () => {
  it.each(FAMILIES.filter((f) => f !== 'multi'))('renders the %s swatch', async (family) => {
    await render(<ColorDot family={family} accessibilityLabel={family} />);
    expect(fills('color-dot-fill')).toEqual([swatch[family]]);
  });

  it('renders multi as four flat quadrants', async () => {
    await render(<ColorDot family="multi" accessibilityLabel="multi" />);
    expect(fills('color-dot-fill')).toEqual([...multiSwatch]);
  });

  it('is a labelled image when not interactive', async () => {
    await render(<ColorDot family="navy" accessibilityLabel="Navy" />);
    expect(screen.getByRole('image', { name: 'Navy' })).toBeTruthy();
  });

  it('is a selectable button when pressable', async () => {
    const onPress = jest.fn();
    await render(<ColorDot family="red" accessibilityLabel="Red" selected onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Red' });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the selected ring and shows a separate focus ring outside it', async () => {
    await render(<ColorDot family="red" accessibilityLabel="Red" selected onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Red' });
    await fireEvent(button, 'focus');
    expect(StyleSheet.flatten(button.props.style).borderColor).toBe(colors.ink);
    const ring = StyleSheet.flatten(screen.getByTestId('focus-ring').props.style);
    expect(ring).toEqual(expect.objectContaining({ borderColor: colors.accent, top: -4, borderWidth: 2 }));
  });
});
