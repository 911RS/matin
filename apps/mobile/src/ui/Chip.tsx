import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';
import { useType } from './typeContext';
import { FocusRing, useFocusRing } from './focus';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  role?: 'button' | 'radio';
};

const HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

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
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[type.label, selected && styles.selectedLabel]} numberOfLines={1}>
        {label}
      </Text>
      {focused && <FocusRing radius={radius.round} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  pressed: { opacity: 0.85 },
  selectedLabel: { color: colors.surface },
});
