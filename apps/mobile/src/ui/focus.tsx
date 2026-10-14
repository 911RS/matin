import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const GAP = 3;

export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    focusProps: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  };
}

export function FocusRing({ radius, gap = GAP }: { radius: number; gap?: number }) {
  return (
    <View
      testID="focus-ring"
      pointerEvents="none"
      style={[styles.ring, { top: -gap, left: -gap, right: -gap, bottom: -gap, borderRadius: radius + gap }]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
