import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import type { ItemRow } from '@tenue/backend';
import type { Category } from '@tenue/engine';
import { useItemImage } from '../closet/useItems';
import { layoutFlatLay } from '../today/flatLay';
import { colors, familyTint, radius, space } from '../theme';
import { Stage } from '../ui/Stage';

type Slot = 'top' | 'bottom' | 'shoes';

const GHOST_SHRINK = 0.1;

const SLOTS: Slot[] = ['top', 'bottom', 'shoes'];

export function pickSlots(items: readonly ItemRow[]): Record<Slot, ItemRow | undefined> {
  const first = (category: Category) => items.find((i) => i.category === category);
  return { top: first('top') ?? first('dress'), bottom: first('bottom'), shoes: first('shoes') };
}

function Cutout({ item }: { item: ItemRow }) {
  const source = useItemImage(item.image_path);
  if (!source) return null;
  return <Image source={source} style={styles.cutout} contentFit="contain" cachePolicy="disk" />;
}

type Props = { items: readonly ItemRow[]; compact?: boolean };

export function OnboardingStage({ items, compact = false }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const inset = compact ? space(12) : space(24);
  const chosen = pickSlots(items);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width: Math.max(0, width - inset * 2), height: Math.max(0, height - inset * 2) });
  };

  const frames = layoutFlatLay(
    SLOTS.map((slot) => ({ id: slot, category: slot })),
    size.width,
    size.height,
  );

  return (
    <Stage
      tint={familyTint.navy}
      style={compact ? styles.compact : styles.large}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.fill} onLayout={onLayout}>
        {frames.map((frame) => {
          const item = chosen[frame.id as Slot];
          const shrink = item ? 0 : GHOST_SHRINK;
          return (
            <View
              key={frame.id}
              style={[
                styles.slot,
                !item && styles.ghost,
                {
                  left: inset + frame.x + frame.width * shrink,
                  top: inset + frame.y + frame.height * shrink,
                  width: frame.width * (1 - shrink * 2),
                  height: frame.height * (1 - shrink * 2),
                  zIndex: frame.z,
                },
              ]}
            >
              {item && <Cutout item={item} />}
            </View>
          );
        })}
      </View>
    </Stage>
  );
}

const styles = StyleSheet.create({
  large: { flex: 1, minHeight: 160, maxHeight: 360 },
  compact: { height: 168 },
  fill: { flex: 1 },
  cutout: { width: '100%', height: '100%' },
  slot: { position: 'absolute' },
  ghost: { borderRadius: radius.tile, backgroundColor: colors.line },
});
