import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { colors, space } from '../theme';

type Props = {
  children: ReactNode;
  edges?: Edge[];
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

const DEFAULT_EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

export function Screen({ children, edges = DEFAULT_EDGES, scroll = false, style, contentContainerStyle }: Props) {
  if (!scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.screen, styles.padded, style]}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  padded: { paddingHorizontal: space(20) },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space(20) },
});
