import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, size } from '../theme';
import { FocusRing, useFocusRing } from './focus';
import type { IconName } from './icons';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ icon, accessibilityLabel, onPress, disabled = false, style }: Props) {
  const { focused, focusProps } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={22} color={disabled ? colors.graphite : colors.ink} />
      {focused && <FocusRing radius={radius.round} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: size.control,
    height: size.control,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
