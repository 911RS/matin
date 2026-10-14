import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { ImageSource } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, space } from '../theme';
import { FocusRing, useFocusRing } from './focus';

type Props = {
  source: ImageSource | number | string | null;
  accessibilityLabel: string;
  onPress?: () => void;
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Tile({ source, accessibilityLabel, onPress, dimmed = false, style }: Props) {
  const { focused, focusProps } = useFocusRing();
  const image = source ? (
    <Image source={source} style={styles.image} contentFit="contain" cachePolicy="disk" transition={120} />
  ) : null;
  const content = (
    <>
      <View style={[styles.fill, dimmed && styles.dimmed]}>{image}</View>
      {dimmed && (
        <View style={styles.badge} pointerEvents="none">
          <Ionicons name="water-outline" size={16} color={colors.graphite} />
        </View>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={[styles.tile, style]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, style]}
    >
      {content}
      {focused && <FocusRing radius={radius.tile} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    aspectRatio: 1,
    backgroundColor: colors.tile,
    borderRadius: radius.tile,
    padding: space(12),
  },
  image: { flex: 1 },
  fill: { flex: 1 },
  dimmed: { opacity: 0.4 },
  badge: { position: 'absolute', top: space(8), right: space(8) },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
