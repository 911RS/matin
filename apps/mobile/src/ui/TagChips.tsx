import { StyleSheet, View } from 'react-native';
import type { ColorFamily } from '@tenue/engine';
import { space } from '../theme';
import { Chip } from './Chip';
import { ColorDot } from './ColorDot';
import { SectionLabel } from './SectionLabel';

type Value = string | number;

type ChipsProps<T extends Value> = {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
};

export function TagChips<T extends Value>({ label, options, value, onChange }: ChipsProps<T>) {
  return (
    <View style={styles.group}>
      <SectionLabel>{label}</SectionLabel>
      <View style={styles.wrap}>
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

type ColorProps = {
  label: string;
  families: readonly ColorFamily[];
  labelFor: (family: ColorFamily) => string;
  value: ColorFamily | null;
  onChange: (family: ColorFamily) => void;
};

export function ColorChoices({ label, families, labelFor, value, onChange }: ColorProps) {
  return (
    <View style={styles.group}>
      <SectionLabel>{label}</SectionLabel>
      <View style={[styles.wrap, styles.dots]}>
        {families.map((family) => (
          <ColorDot
            key={family}
            family={family}
            accessibilityLabel={labelFor(family)}
            selected={family === value}
            onPress={() => onChange(family)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space(12) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(8) },
  dots: { gap: space(4), marginLeft: -space(4) },
});
