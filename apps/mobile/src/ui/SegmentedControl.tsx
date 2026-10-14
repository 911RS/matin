import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { FocusRing, useFocusRing } from './focus';
import { haptic } from './haptics';
import { useType } from './typeContext';

type Option<K extends string> = { readonly key: K; readonly label: string };

type Props<K extends string> = {
  options: readonly Option<K>[];
  value: K | null;
  onChange: (key: K) => void;
  accessibilityLabel: string;
};

function Segment<K extends string>({ option, selected, onPress }: { option: Option<K>; selected: boolean; onPress: () => void }) {
  const type = useType();
  const { focused, focusProps } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...focusProps}
      style={[styles.segment, selected && styles.selected]}
    >
      <Text
        style={[type.label, styles.label, selected && styles.selectedLabel]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={1.4}
      >
        {option.label}
      </Text>
      {focused && <FocusRing radius={SEGMENT_RADIUS} />}
    </Pressable>
  );
}

export function SegmentedControl<K extends string>({ options, value, onChange, accessibilityLabel }: Props<K>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {options.map((option) => (
        <Segment
          key={option.key}
          option={option}
          selected={option.key === value}
          onPress={() => {
            if (option.key === value) return;
            haptic();
            onChange(option.key);
          }}
        />
      ))}
    </View>
  );
}

const SEGMENT_RADIUS = 8;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.tile,
    borderRadius: SEGMENT_RADIUS + 2,
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    borderRadius: SEGMENT_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(8),
  },
  selected: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.graphite },
  selectedLabel: { fontWeight: '600', color: colors.ink },
});
