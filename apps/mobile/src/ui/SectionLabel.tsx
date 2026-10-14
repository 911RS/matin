import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme';
import { useType } from './typeContext';

export function SectionLabel({ children }: { children: string }) {
  const type = useType();
  return (
    <Text style={[type.label, styles.label]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.graphite },
});
