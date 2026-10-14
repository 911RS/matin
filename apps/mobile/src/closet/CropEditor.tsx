import { useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, space } from '../theme';
import { useType } from '../ui/typeContext';
import { dragCrop, FULL_CROP } from './cropMath';
import type { Crop, CropHandle } from './cropMath';

type Props = {
  visible: boolean;
  uri: string;
  aspect: number;
  onDone: (crop: Crop) => void;
  onCancel: () => void;
};

const CORNERS: Exclude<CropHandle, 'move'>[] = ['tl', 'tr', 'bl', 'br'];
const HANDLE = 44;
const ARM = 22;
const LINE = 3;
const FRAME_PADDING = space(24);

type Box = { width: number; height: number };

function fit(aspect: number, area: Box): Box {
  if (area.width <= 0 || area.height <= 0 || aspect <= 0) return { width: 0, height: 0 };
  const width = Math.min(area.width, area.height * aspect);
  return { width, height: width / aspect };
}

function useDrag(handle: CropHandle, box: Box, crop: Crop, setCrop: (c: Crop) => void) {
  const live = useRef({ box, crop, start: crop });
  live.current.box = box;
  live.current.crop = crop;
  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          live.current.start = live.current.crop;
        },
        onPanResponderMove: (_, g) => {
          const { box: b, start } = live.current;
          if (b.width <= 0 || b.height <= 0) return;
          setCrop(dragCrop(start, handle, g.dx / b.width, g.dy / b.height));
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [handle, setCrop],
  );
}

function Corner({ handle, box, crop, setCrop }: { handle: Exclude<CropHandle, 'move'>; box: Box; crop: Crop; setCrop: (c: Crop) => void }) {
  const responder = useDrag(handle, box, crop, setCrop);
  const left = handle === 'tl' || handle === 'bl';
  const top = handle === 'tl' || handle === 'tr';
  const x = (left ? crop.x : crop.x + crop.width) * box.width - HANDLE / 2;
  const y = (top ? crop.y : crop.y + crop.height) * box.height - HANDLE / 2;
  const inset = HANDLE / 2 - LINE;
  return (
    <View testID={`crop-${handle}`} {...responder.panHandlers} style={[styles.handle, { left: x, top: y }]}>
      <View
        style={[
          styles.armH,
          top ? { top: inset } : { bottom: inset },
          left ? { left: inset } : { right: inset },
        ]}
      />
      <View
        style={[
          styles.armV,
          top ? { top: inset } : { bottom: inset },
          left ? { left: inset } : { right: inset },
        ]}
      />
    </View>
  );
}

export function CropEditor({ visible, uri, aspect, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const type = useType();
  const [area, setArea] = useState<Box>({ width: 0, height: 0 });
  const [crop, setCrop] = useState<Crop>(FULL_CROP);
  const [natural, setNatural] = useState(aspect);
  const box = fit(natural, { width: area.width - FRAME_PADDING * 2, height: area.height - FRAME_PADDING * 2 });
  const move = useDrag('move', box, crop, setCrop);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  };

  const frame = {
    left: crop.x * box.width,
    top: crop.y * box.height,
    width: crop.width * box.width,
    height: crop.height * box.height,
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12} style={styles.barButton}>
            <Text style={[type.body, styles.light]}>{t('add.cropCancel')}</Text>
          </Pressable>
          <Text style={[type.bodyStrong, styles.light]} accessibilityRole="header">
            {t('add.cropTitle')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDone(crop)}
            hitSlop={12}
            style={[styles.barButton, styles.end]}
          >
            <Text style={[type.bodyStrong, styles.light]}>{t('add.cropDone')}</Text>
          </Pressable>
        </View>
        <View style={styles.area} onLayout={onLayout}>
          <View style={[styles.box, box]}>
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              accessible={false}
              onLoad={(e) => {
                if (e.source.width > 0 && e.source.height > 0) setNatural(e.source.width / e.source.height);
              }}
            />
            <View pointerEvents="none" style={[styles.shade, { left: 0, top: 0, right: 0, height: frame.top }]} />
            <View
              pointerEvents="none"
              style={[styles.shade, { left: 0, right: 0, top: frame.top + frame.height, bottom: 0 }]}
            />
            <View
              pointerEvents="none"
              style={[styles.shade, { left: 0, width: frame.left, top: frame.top, height: frame.height }]}
            />
            <View
              pointerEvents="none"
              style={[styles.shade, { left: frame.left + frame.width, right: 0, top: frame.top, height: frame.height }]}
            />
            <View testID="crop-move" {...move.panHandlers} style={[styles.frame, frame]}>
              <View pointerEvents="none" style={[styles.third, styles.thirdV, { left: '33.33%' }]} />
              <View pointerEvents="none" style={[styles.third, styles.thirdV, { left: '66.66%' }]} />
              <View pointerEvents="none" style={[styles.third, styles.thirdH, { top: '33.33%' }]} />
              <View pointerEvents="none" style={[styles.third, styles.thirdH, { top: '66.66%' }]} />
            </View>
            {CORNERS.map((handle) => (
              <Corner key={handle} handle={handle} box={box} crop={crop} setCrop={setCrop} />
            ))}
          </View>
        </View>
        <View style={styles.bottomBar}>
          <Pressable accessibilityRole="button" onPress={() => setCrop(FULL_CROP)} hitSlop={12}>
            <Text style={[type.label, styles.muted]}>{t('add.cropReset')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(20),
    minHeight: 52,
  },
  barButton: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  end: { alignItems: 'flex-end' },
  light: { color: WHITE },
  muted: { color: colors.line },
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  box: { position: 'relative', backgroundColor: colors.tile },
  shade: { position: 'absolute', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  frame: { position: 'absolute', borderWidth: 1, borderColor: WHITE },
  third: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.35)' },
  thirdV: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  thirdH: { left: 0, right: 0, height: StyleSheet.hairlineWidth },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE },
  armH: { position: 'absolute', width: ARM, height: LINE, backgroundColor: WHITE },
  armV: { position: 'absolute', width: LINE, height: ARM, backgroundColor: WHITE },
  bottomBar: { alignItems: 'center', paddingVertical: space(16) },
});
