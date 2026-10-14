import { StyleSheet, View } from 'react-native';
import { colors, radius, space } from '../theme';

export function SegmentBar({ filled, total }: { filled: number; total: number }) {
  return (
    <View style={styles.bar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, i < filled && styles.filled]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: space(4) },
  segment: { flex: 1, height: 6, borderRadius: radius.round, backgroundColor: colors.line },
  filled: { backgroundColor: colors.ink },
});
