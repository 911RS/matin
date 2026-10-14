import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import type { ImageSource } from 'expo-image';
import type { ItemRow } from '@tenue/backend';
import type { Category } from '@tenue/engine';
import { useTranslation } from 'react-i18next';
import { useItemImage, useItemLabel } from '../closet/useItems';
import { layoutFlatLay } from '../today/flatLay';
import type { FlatLayPiece } from '../today/flatLay';
import { colors, radius, space } from '../theme';
import { FocusRing, useFocusRing } from './focus';
import { haptic } from './haptics';
import { useType } from './typeContext';
import { useReduceMotion } from './useReduceMotion';

const SWAP_MS = 180;
const SWAP_SHIFT = 8;
const INSET = space(24);
const SLOT_SHRINK = 0.08;

type Size = { width: number; height: number };

function slotOf(category: Category): string {
  return category === 'dress' ? 'top' : category;
}

function useInnerSize(): [Size, (e: LayoutChangeEvent) => void] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width: Math.max(0, width - INSET * 2), height: Math.max(0, height - INSET * 2) });
  };
  return [size, onLayout];
}

function frameStyle(piece: FlatLayPiece, shrink = 0) {
  const dx = piece.width * shrink;
  const dy = piece.height * shrink;
  return {
    left: INSET + piece.x + dx,
    top: INSET + piece.y + dy,
    width: piece.width - dx * 2,
    height: piece.height - dy * 2,
    zIndex: piece.z,
  };
}

type PieceProps = {
  item: ItemRow;
  frame: FlatLayPiece;
  disabled: boolean;
  readOnly: boolean;
  onSwap: (slot: Category) => void;
};

function Piece({ item, frame, disabled, readOnly, onSwap }: PieceProps) {
  const { t } = useTranslation();
  const labelFor = useItemLabel();
  const reduceMotion = useReduceMotion();
  const { focused, focusProps } = useFocusRing();
  const source = useItemImage(item.image_path);
  const shown = useRef<{ id: string; source: ImageSource | null }>({ id: item.id, source });
  const progress = useRef(new Animated.Value(1)).current;
  const [outgoing, setOutgoing] = useState<ImageSource | null>(null);

  const uri = source?.uri;
  useEffect(() => {
    if (!source) return;
    const previous = shown.current;
    shown.current = { id: item.id, source };
    if (previous.id === item.id || !previous.source || reduceMotion) {
      progress.setValue(1);
      setOutgoing(null);
      return;
    }
    setOutgoing(previous.source);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: SWAP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setOutgoing(null);
    });
    return () => animation.stop();
  }, [item.id, uri, reduceMotion, progress]);

  const label = labelFor(item.category, item.color_family);
  const current = source ?? shown.current.source;
  const incoming = {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [SWAP_SHIFT, 0] }) }],
  };
  const leaving = { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) };

  const content = (
    <>
      {outgoing && (
        <Animated.View testID="piece-outgoing" style={[StyleSheet.absoluteFill, leaving]}>
          <Image source={outgoing} style={styles.image} contentFit="contain" cachePolicy="disk" />
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, incoming]}>
        {current && (
          <Image
            source={current}
            style={styles.image}
            contentFit="contain"
            cachePolicy="disk"
            accessibilityLabel={label}
          />
        )}
      </Animated.View>
      {focused && <FocusRing radius={radius.tile} />}
    </>
  );

  if (readOnly) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.piece, frameStyle(frame)]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('today.swapPiece', { category: label.toLowerCase() })}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic();
        onSwap(item.category);
      }}
      {...focusProps}
      style={[styles.piece, frameStyle(frame)]}
    >
      {content}
    </Pressable>
  );
}

type OutfitStackProps = {
  items: ItemRow[];
  disabled?: boolean;
  readOnly?: boolean;
  onSwap: (slot: Category) => void;
};

export function OutfitStack({ items, disabled = false, readOnly = false, onSwap }: OutfitStackProps) {
  const [size, onLayout] = useInnerSize();
  const frames = layoutFlatLay(items, size.width, size.height);
  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <View testID="outfit-stack" style={styles.fill} onLayout={onLayout}>
      {frames.map((frame) => (
        <Piece
          key={slotOf(frame.category)}
          item={byId.get(frame.id)!}
          frame={frame}
          disabled={disabled}
          readOnly={readOnly}
          onSwap={onSwap}
        />
      ))}
    </View>
  );
}

type SlotStackProps = {
  categories: Category[];
  missing?: Category[];
};

export function SlotStack({ categories, missing = [] }: SlotStackProps) {
  const { t } = useTranslation();
  const type = useType();
  const [size, onLayout] = useInnerSize();
  const frames = layoutFlatLay(
    categories.map((category) => ({ id: category, category })),
    size.width,
    size.height,
  );
  return (
    <View style={styles.fill} onLayout={onLayout} accessibilityElementsHidden={missing.length === 0}>
      {frames.map((frame) => {
        const empty = missing.includes(frame.category);
        return (
          <View key={frame.id} style={[styles.slot, empty ? styles.missing : styles.loading, frameStyle(frame, SLOT_SHRINK)]}>
            {empty && <Text style={type.eyebrow}>{t(`category.${frame.category}`)}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  piece: { position: 'absolute' },
  image: { flex: 1 },
  slot: { position: 'absolute', borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  loading: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line },
  missing: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.graphite },
});
