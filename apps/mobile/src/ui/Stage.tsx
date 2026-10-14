import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { radius } from '../theme';

type Props = Pick<ViewProps, 'accessibilityElementsHidden' | 'importantForAccessibility'> & {
  tint: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Stage({ tint, children, style, ...a11y }: Props) {
  return (
    <View {...a11y} style={[styles.stage, { backgroundColor: tint }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { borderRadius: radius.stage, overflow: 'hidden' },
});
