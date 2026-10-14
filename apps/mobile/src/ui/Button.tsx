import { isValidElement } from 'react';
import type { ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, size, space } from '../theme';
import { FocusRing, useFocusRing } from './focus';
import type { IconName } from './icons';
import { useType } from './typeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text' | 'danger-text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName | ReactElement;
  disabled?: boolean;
  blocked?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const filled = (variant: ButtonVariant) => variant === 'primary' || variant === 'secondary' || variant === 'danger';

function foreground(variant: ButtonVariant, disabled: boolean): string {
  if (variant === 'text') return colors.graphite;
  if (disabled) return colors.graphite;
  if (variant === 'primary' || variant === 'danger') return colors.paper;
  if (variant === 'danger-text') return colors.danger;
  return colors.ink;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  blocked = false,
  loading = false,
  accessibilityLabel,
  style,
}: Props) {
  const type = useType();
  const { focused, focusProps } = useFocusRing();
  const inactive = disabled || blocked || loading;
  const color = foreground(variant, disabled);
  const text = variant === 'text' ? type.label : type.bodyStrong;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.base,
        filled(variant) ? styles.filled : styles.bare,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        disabled && filled(variant) && styles.disabled,
        blocked && !disabled && styles.blocked,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.content, loading && styles.hidden]}>
        {typeof icon === 'string' && <Ionicons name={icon} size={20} color={color} />}
        {isValidElement(icon) && icon}
        <Text style={[text, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={color} />}
      {focused && <FocusRing radius={radius.control} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(24),
  },
  filled: { height: size.control },
  bare: { minHeight: 44, paddingHorizontal: space(16) },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.tile },
  danger: { backgroundColor: colors.danger },
  disabled: { backgroundColor: colors.tile },
  blocked: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  content: { flexDirection: 'row', alignItems: 'center', gap: space(8) },
  hidden: { opacity: 0 },
});
