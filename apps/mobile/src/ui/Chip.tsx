import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, space } from '../theme';
import { useType } from './typeContext';
import { FocusRing, useFocusRing } from './focus';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  role?: 'button' | 'radio';
};

const HIT_SLOP = { top: 6, bottom: 6, left: 0, right: 0 };

export function Chip({ label, selected = false, onPress, accessibilityLabel, role = 'button' }: Props) {
  const type = useType();
  const { focused, focusProps } = useFocusRing();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.base, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[type.label, styles.label, selected && styles.selectedLabel]} numberOfLines={1}>
        {label}
      </Text>
      {focused && <FocusRing radius={radius.round} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 34,
    paddingHorizontal: space(16),
    borderRadius: radius.round,
    backgroundColor: colors.tile,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.ink },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  label: { color: colors.ink },
  selectedLabel: { color: colors.paper },
});
