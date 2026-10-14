import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, space } from '../theme';
import { Sheet } from '../ui/Sheet';
import { useType } from '../ui/typeContext';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  visible: boolean;
  title: string;
  closeLabel: string;
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

export function OptionSheet<T extends string>({ visible, title, closeLabel, options, selected, onSelect, onClose }: Props<T>) {
  const type = useType();
  const insets = useSafeAreaInsets();
  return (
    <Sheet visible={visible} title={title} closeLabel={closeLabel} onClose={onClose} padded={false}>
      {options.map((o, i) => {
        const active = o.value === selected;
        return (
          <View key={o.value}>
            {i > 0 && <View style={styles.separator} />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(o.value)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={[active ? type.bodyStrong : type.body, styles.text]}>{o.label}</Text>
              {active && <Ionicons name="checkmark" size={22} color={colors.ink} />}
            </Pressable>
          </View>
        );
      })}
      <View style={{ height: insets.bottom + space(16) }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(20) },
  pressed: { backgroundColor: colors.tile },
  text: { flex: 1 },
  separator: { height: 1, marginHorizontal: space(20), backgroundColor: colors.line },
});
