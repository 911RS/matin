import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { familyTint } from '../theme';
import { Stage } from '../ui/Stage';

const PIECES = [
  { source: require('../../assets/signin/top.png'), x: 0, y: 0, w: 240, h: 193 },
  { source: require('../../assets/signin/trousers.png'), x: 132, y: 132, w: 172, h: 332 },
  { source: require('../../assets/signin/shoes.png'), x: 0, y: 415, w: 224, h: 108 },
] as const;

const BOX = { w: 304, h: 523 };
const FILL = 0.84;

export function SignInArt({ compact = false }: { compact?: boolean }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const scale = size ? Math.min((size.w * FILL) / BOX.w, (size.h * FILL) / BOX.h) : 0;
  const left = size ? (size.w - BOX.w * scale) / 2 : 0;
  const top = size ? (size.h - BOX.h * scale) / 2 : 0;

  return (
    <Stage
      tint={familyTint.navy}
      style={[styles.stage, compact && styles.compact]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
        {scale > 0 &&
          PIECES.map((piece, i) => (
            <Image
              key={i}
              source={piece.source}
              contentFit="contain"
              transition={150}
              accessible={false}
              style={{
                position: 'absolute',
                left: left + piece.x * scale,
                top: top + piece.y * scale,
                width: piece.w * scale,
                height: piece.h * scale,
              }}
            />
          ))}
      </View>
    </Stage>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 240 },
  compact: { minHeight: 88 },
});
