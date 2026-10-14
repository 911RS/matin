import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { colors, radius } from '../../theme';
import { Chip } from '../Chip';

function boxStyle(role: 'button' | 'radio', name: string) {
  return StyleSheet.flatten(screen.getByRole(role, { name }).props.style);
}

describe('Chip', () => {
  it('is an ink capsule with a paper label when selected', async () => {
    await render(<Chip label="All" selected onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'All' }).props.accessibilityState).toEqual({ selected: true });
    expect(boxStyle('button', 'All')).toEqual(expect.objectContaining({ backgroundColor: colors.ink, borderRadius: radius.round }));
    expect(StyleSheet.flatten(screen.getByText('All').props.style).color).toBe(colors.paper);
  });

  it('is a tinted capsule with an ink label when not selected', async () => {
    await render(<Chip label="Tops" onPress={() => {}} />);
    expect(boxStyle('button', 'Tops').backgroundColor).toBe(colors.tile);
    expect(StyleSheet.flatten(screen.getByText('Tops').props.style).color).toBe(colors.ink);
  });

  it('reports checked when used as a radio', async () => {
    await render(<Chip label="Work" role="radio" selected onPress={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Work' }).props.accessibilityState).toEqual({ checked: true });
  });
});
