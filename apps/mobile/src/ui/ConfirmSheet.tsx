import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '../theme';
import { Button } from './Button';
import { useType } from './typeContext';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmSheet({ visible, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  const type = useType();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space(20) }]} accessibilityViewIsModal>
          <Text style={type.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[type.body, styles.body]}>{body}</Text>
          <View style={styles.actions}>
            <Button label={confirmLabel} variant="danger" onPress={onConfirm} />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space(24),
    paddingHorizontal: space(20),
  },
  body: { marginTop: space(8), color: colors.graphite },
  actions: { marginTop: space(24), gap: space(12) },
});
