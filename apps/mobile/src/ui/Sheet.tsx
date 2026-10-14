import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '../theme';
import { useType } from './typeContext';

type Props = {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  padded?: boolean;
};

export function Sheet({ visible, title, closeLabel, onClose, children, padded = true }: Props) {
  const type = useType();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View
          style={[styles.sheet, padded && { paddingBottom: insets.bottom + space(16) }]}
          accessibilityViewIsModal
        >
          <Text style={[type.title, styles.title]} accessibilityRole="header">
            {title}
          </Text>
          <View style={padded ? styles.padded : styles.flush}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.stage,
    borderTopRightRadius: radius.stage,
    paddingTop: space(24),
    maxHeight: '86%',
  },
  title: { paddingHorizontal: space(20), marginBottom: space(12) },
  padded: { paddingHorizontal: space(20), paddingTop: space(4) },
  flush: { flexShrink: 1 },
});
