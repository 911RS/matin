import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';
import { useType } from './typeContext';

type Props = {
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function Slot({ label, style }: Props) {
  const type = useType();
  return (
    <View testID="slot" style={[styles.slot, style]}>
      <Text style={type.eyebrow}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
