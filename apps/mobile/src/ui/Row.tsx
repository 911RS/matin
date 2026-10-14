import { Children, Fragment, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, hairline, radius, space, tabular } from '../theme';
import { FocusRing, useFocusRing } from './focus';
import { useType } from './typeContext';


export function Group({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 && <View style={styles.hairline} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export type RowTone = 'default' | 'danger' | 'accent';

type RowProps = {
  label: string;
  value?: string;
  hint?: string;
  tone?: RowTone;
  onPress?: () => void;
  accessory?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

const TONE: Record<RowTone, string> = { default: colors.ink, danger: colors.danger, accent: colors.accent };

export function Row({
  label,
  value,
  hint,
  tone = 'default',
  onPress,
  accessory,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: RowProps) {
  const type = useType();
  const { focused, focusProps } = useFocusRing();
  const chevron = onPress && accessory === undefined && tone !== 'danger';
  const content = (
    <>
      <View style={styles.text}>
        <Text style={[type.body, { color: disabled ? colors.graphite : TONE[tone] }]}>{label}</Text>
        {hint ? <Text style={type.caption}>{hint}</Text> : null}
      </View>
      {value ? (
        <Text style={[type.body, tabular, styles.value]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory}
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.graphite} />}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} testID={testID} accessible={accessory === undefined} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${label}, ${value}` : label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
      {focused && <FocusRing radius={radius.input} gap={-3} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.input, overflow: 'hidden' },
  hairline: { height: hairline, marginLeft: space(16), backgroundColor: colors.line },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(12),
    paddingHorizontal: space(16),
    paddingVertical: space(12),
  },
  pressed: { backgroundColor: colors.tile },
  text: { flex: 1, gap: 2 },
  value: { color: colors.graphite, flexShrink: 1, textAlign: 'right' },
});
