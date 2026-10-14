import { Pressable, StyleSheet, View } from 'react-native';
import type { ColorFamily } from '@tenue/engine';
import { colors, multiSwatch, radius, swatch } from '../theme';
import { FocusRing, useFocusRing } from './focus';

type Props = {
  family: ColorFamily;
  accessibilityLabel: string;
  selected?: boolean;
  onPress?: () => void;
};

const HIT_SLOP = 4;
const QUADRANTS = [
  { top: 0, left: 0 },
  { top: 0, right: 0 },
  { bottom: 0, right: 0 },
  { bottom: 0, left: 0 },
] as const;

function Swatch({ family }: { family: ColorFamily }) {
  return (
    <View style={styles.dot}>
      {family === 'multi' ? (
        multiSwatch.map((color, i) => (
          <View
            key={color}
            testID="color-dot-fill"
            style={[styles.quadrant, QUADRANTS[i], { backgroundColor: color }]}
          />
        ))
      ) : (
        <View testID="color-dot-fill" style={[styles.fill, { backgroundColor: swatch[family] }]} />
      )}
      <View style={styles.ring} pointerEvents="none" />
    </View>
  );
}

export function ColorDot({ family, accessibilityLabel, selected = false, onPress }: Props) {
  const { focused, focusProps } = useFocusRing();

  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.frame}>
        <Swatch family={family} />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.frame,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Swatch family={family} />
      {focused && <FocusRing radius={radius.round} gap={FOCUS_GAP} />}
    </Pressable>
  );
}

const DOT = 28;
const FOCUS_GAP = 4;

const styles = StyleSheet.create({
  frame: {
    width: DOT + 8,
    height: DOT + 8,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.ink },
  pressed: { opacity: 0.85 },
  dot: { width: DOT, height: DOT, borderRadius: radius.round, overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill },
  quadrant: { position: 'absolute', width: DOT / 2, height: DOT / 2 },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.line,
  },
});
