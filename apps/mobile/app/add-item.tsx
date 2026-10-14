import { useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CropEditor } from '../src/closet/CropEditor';
import { isFullCrop } from '../src/closet/cropMath';
import { adjustImage } from '../src/photo/adjust';
import type { ImageEdit } from '../src/photo/adjust';
import { saveNewItem } from '../src/closet/addItem';
import { addItemReducer, failMessageKey, initialAddState } from '../src/closet/addItemReducer';
import type { AddState, DraftTags, PhotoSize } from '../src/closet/addItemReducer';
import { removeFile } from '../src/closet/pending';
import { TagEditor } from '../src/closet/TagEditor';
import { useItemLabel } from '../src/closet/useItems';
import { useRepo } from '../src/data/RepoProvider';
import { errorCode } from '../src/photo/errors';
import { preparePhoto } from '../src/photo/prepare';
import { warmUpForAdding } from '../src/photo/warmup';
import { colors, radius, space, swatch } from '../src/theme';
import { Button, IconButton, Stage } from '../src/ui';
import { onHardwareBack } from '../src/ui/hardwareBack';
import { useType } from '../src/ui/typeContext';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };

function pickedEvent(asset: ImagePicker.ImagePickerAsset) {
  const size = asset.width > 0 && asset.height > 0 ? { width: asset.width, height: asset.height } : null;
  return { type: 'picked' as const, uri: asset.uri, size };
}

function releasePicked(uri: string | null): void {
  if (uri && Platform.OS === 'web') removeFile(uri);
}

function pickedOf(state: AddState): string | null {
  return state.step === 'choose' ? null : state.uri;
}

function cutoutOf(state: AddState): string | null {
  return state.step === 'review' ? (state.prepared?.cutoutUri ?? null) : null;
}

function colorHexFor(state: AddState & { step: 'review' }, tags: DraftTags): string {
  const detected = state.prepared?.tags;
  if (detected && tags.colorFamily === detected.colorFamily) return detected.colorHex;
  return tags.colorFamily ? swatch[tags.colorFamily] : '';
}

const STAGE_PADDING = space(24);
const SIDE = space(24);

function fitInside(size: PhotoSize | null, box: PhotoSize): PhotoSize {
  if (!size || size.width <= 0 || size.height <= 0) return box;
  const scale = Math.min(box.width / size.width, box.height / size.height);
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

function PhotoFrame({ uri, dimmed, label, maxHeight }: { uri: string; dimmed?: boolean; label: string; maxHeight: number }) {
  return (
    <View style={[styles.frame, { maxHeight }]} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      {dimmed && (
        <View style={[StyleSheet.absoluteFill, styles.dim]}>
          <ActivityIndicator color={colors.onAccent} size="large" />
        </View>
      )}
    </View>
  );
}

export default function AddItem() {
  const { t } = useTranslation();
  const type = useType();
  const repo = useRepo();
  const queryClient = useQueryClient();
  const labelFor = useItemLabel();
  const { width, height } = useWindowDimensions();
  const frameMax = Math.round(height * 0.55);
  const [state, dispatch] = useReducer(addItemReducer, initialAddState);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [libraryDenied, setLibraryDenied] = useState(false);
  const cutout = useRef<string | null>(null);
  const picked = useRef<string | null>(null);
  const saved = useRef(false);
  const edits = useRef(new Set<string>());
  const pristineCutout = useRef<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  function discardEdits(keep: (string | null)[] = []) {
    for (const uri of edits.current) if (!keep.includes(uri)) removeFile(uri);
    edits.current = new Set([...edits.current].filter((uri) => keep.includes(uri)));
    if (pristineCutout.current && !keep.includes(pristineCutout.current)) removeFile(pristineCutout.current);
    pristineCutout.current = null;
  }

  useEffect(() => {
    cutout.current = cutoutOf(state);
    picked.current = pickedOf(state);
  }, [state]);

  useEffect(() => {
    warmUpForAdding();
    ImagePicker.getCameraPermissionsAsync()
      .then((p) => {
        if (!p.granted && !p.canAskAgain) dispatch({ type: 'cameraDenied' });
      })
      .catch(() => {});
    return () => {
      if (saved.current || savingRef.current) return;
      if (cutout.current) removeFile(cutout.current);
      discardEdits();
      releasePicked(picked.current);
    };
  }, []);

  useEffect(() => {
    if (!saving) return;
    return onHardwareBack(() => true);
  }, [saving]);

  const processingUri = state.step === 'processing' ? state.uri : null;
  const attempt = state.step === 'processing' ? state.attempt : 0;
  const delayMs = state.step === 'processing' ? state.delayMs : 0;

  useEffect(() => {
    if (!processingUri) return;
    let active = true;
    const timer = setTimeout(() => {
      preparePhoto(processingUri).then(
        (prepared) => {
          if (active) dispatch({ type: 'processed', prepared });
          else removeFile(prepared.cutoutUri);
        },
        (error: unknown) => {
          if (active) dispatch({ type: 'failed', code: errorCode(error), now: Date.now() });
        },
      );
    }, delayMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [processingUri, attempt, delayMs]);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
    if (!permission?.granted) {
      dispatch({ type: 'cameraDenied' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS).catch(() => null);
    if (result && !result.canceled) dispatch(pickedEvent(result.assets[0]));
  }

  async function chooseFromLibrary() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      setLibraryDenied(false);
      if (!result.canceled) dispatch(pickedEvent(result.assets[0]));
    } catch {
      setLibraryDenied(true);
    }
  }

  async function adjust(edit: ImageEdit) {
    if (state.step !== 'review' || adjusting) return;
    setAdjusting(true);
    setAdjustError(null);
    const made: string[] = [];
    try {
      const cutoutOnly = edit.kind === 'crop' && state.prepared !== null;
      const photo = cutoutOnly
        ? { uri: state.uri, width: state.size?.width ?? 0, height: state.size?.height ?? 0 }
        : await adjustImage(state.uri, edit, 'jpeg');
      if (!cutoutOnly) made.push(photo.uri);
      const cut = state.prepared ? await adjustImage(state.prepared.cutoutUri, edit, 'png') : null;
      if (cut) made.push(cut.uri);
      if (!state.pristine && state.prepared) pristineCutout.current = state.prepared.cutoutUri;
      for (const uri of cutoutOnly ? [state.prepared?.cutoutUri] : [state.uri, state.prepared?.cutoutUri]) {
        if (uri && edits.current.has(uri)) {
          removeFile(uri);
          edits.current.delete(uri);
        }
      }
      for (const uri of made) edits.current.add(uri);
      dispatch({
        type: 'adjusted',
        uri: photo.uri,
        size: photo.width > 0 && photo.height > 0 ? { width: photo.width, height: photo.height } : state.size,
        cutoutUri: cut?.uri ?? null,
      });
    } catch {
      for (const uri of made) removeFile(uri);
      setAdjustError(t('add.adjustFailed'));
    } finally {
      setAdjusting(false);
    }
  }

  function undoEdits() {
    if (state.step !== 'review' || !state.pristine) return;
    const keep = [state.pristine.uri, state.pristine.prepared?.cutoutUri ?? null];
    discardEdits(keep);
    setAdjustError(null);
    dispatch({ type: 'resetAdjust' });
  }

  function retake() {
    discardEdits();
    if (cutout.current) removeFile(cutout.current);
    releasePicked(picked.current);
    setSaveError(null);
    dispatch({ type: 'retake' });
  }

  async function save() {
    if (state.step !== 'review' || !state.tags.category || !state.tags.colorFamily) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await saveNewItem(
        { repo, queryClient, newId: Crypto.randomUUID },
        {
          prepared: state.prepared ?? { originalUri: state.uri, cutoutUri: null },
          category: state.tags.category,
          colorFamily: state.tags.colorFamily,
          colorHex: colorHexFor(state, state.tags),
          warmth: state.tags.warmth,
          formality: state.tags.formality,
          originalSize: state.size,
        },
      );
      saved.current = true;
      if (state.prepared) removeFile(state.prepared.cutoutUri);
      discardEdits();
      releasePicked(state.uri);
      router.back();
    } catch {
      savingRef.current = false;
      setSaveError(t('item.saveFailed'));
      setSaving(false);
    }
  }

  const close = (
    <IconButton
      icon="close-outline"
      accessibilityLabel={t('common.close')}
      onPress={() => router.back()}
      disabled={saving}
    />
  );

  const topBar = (
    <View style={styles.topBar}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ gestureEnabled: !saving }} />
      <Text style={type.title} accessibilityRole="header">
        {t('add.title')}
      </Text>
      {close}
    </View>
  );

  if (state.step === 'review') {
    const { tags } = state;
    const stageHeight = Math.round(height * 0.4);
    const stageBox = { width: width - SIDE * 2 - STAGE_PADDING * 2, height: stageHeight - STAGE_PADDING * 2 };
    const missing = !tags.category ? t('add.categoryRequired') : !tags.colorFamily ? t('add.colorRequired') : null;
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.padded}>{topBar}</View>
        <ScrollView contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}>
          <Stage style={[styles.stage, styles.shelf, { height: stageHeight }]}>
            {state.prepared ? (
              <Image
                source={{ uri: state.prepared.cutoutUri }}
                style={styles.cutout}
                contentFit="contain"
                accessibilityLabel={labelFor(tags.category, tags.colorFamily)}
              />
            ) : (
              <View style={[styles.original, fitInside(state.size, stageBox)]}>
                <Image
                  source={{ uri: state.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessibilityLabel={labelFor(tags.category, tags.colorFamily)}
                />
              </View>
            )}
          </Stage>
          <View style={styles.tools}>
            <Button
              label={t('add.rotate')}
              icon="refresh-outline"
              variant="secondary"
              onPress={() => adjust({ kind: 'rotate' })}
              blocked={adjusting || saving}
              style={styles.tool}
            />
            <Button
              label={t('add.crop')}
              icon="crop-outline"
              variant="secondary"
              onPress={() => setCropping(true)}
              blocked={adjusting || saving}
              style={styles.tool}
            />
          </View>
          {(state.pristine || adjustError) && (
            <View style={styles.toolNote}>
              {adjustError && (
                <Text style={[type.caption, styles.error]} accessibilityLiveRegion="polite">
                  {adjustError}
                </Text>
              )}
              {state.pristine && (
                <Button label={t('add.undoEdits')} variant="text" onPress={undoEdits} blocked={adjusting || saving} />
              )}
            </View>
          )}
          {cropping && (
            <CropEditor
              visible
              uri={state.prepared?.cutoutUri ?? state.uri}
              aspect={state.size ? state.size.width / state.size.height : 1}
              onCancel={() => setCropping(false)}
              onDone={(crop) => {
                setCropping(false);
                if (!isFullCrop(crop)) adjust({ kind: 'crop', crop });
              }}
            />
          )}
          <TagEditor tags={tags} onChange={(patch) => dispatch({ type: 'edit', patch })} />
        </ScrollView>
        <View style={styles.bottomBar}>
          {(saveError ?? missing) !== null && (
            <Text style={[type.caption, saveError ? styles.error : null]} accessibilityLiveRegion="polite">
              {saveError ?? missing}
            </Text>
          )}
          <Button label={t('add.save')} onPress={save} disabled={missing !== null} loading={saving} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, styles.padded]} edges={['top', 'bottom', 'left', 'right']}>
      {topBar}
      {state.step === 'choose' && (
        <>
          <View style={[styles.frame, styles.placeholder, { maxHeight: frameMax }]} importantForAccessibility="no-hide-descendants">
            <Ionicons name="shirt-outline" size={64} color={colors.graphite} />
          </View>
          <View style={styles.actions}>
            {state.cameraDenied ? (
              <Text style={type.caption}>{t('add.cameraDenied')}</Text>
            ) : (
              <Button label={t('add.camera')} icon="camera-outline" onPress={takePhoto} />
            )}
            <Button
              label={t('add.library')}
              icon="images-outline"
              variant={state.cameraDenied ? 'primary' : 'secondary'}
              onPress={chooseFromLibrary}
            />
            {libraryDenied ? (
              <Text style={[type.caption, styles.error]}>{t('add.libraryDenied')}</Text>
            ) : (
              <Text style={type.caption}>{t('add.chooseHint')}</Text>
            )}
          </View>
        </>
      )}
      {state.step === 'processing' && (
        <>
          <PhotoFrame uri={state.uri} dimmed label={t('add.photoAlt')} maxHeight={frameMax} />
          <View style={styles.message} accessibilityLiveRegion="polite">
            <Text style={type.bodyStrong}>{state.preparing ? t('add.preparing') : t('add.processing')}</Text>
            {state.preparing && <Text style={type.caption}>{t('add.preparingHint')}</Text>}
          </View>
        </>
      )}
      {state.step === 'failed' && (
        <>
          <PhotoFrame uri={state.uri} label={t('add.photoAlt')} maxHeight={frameMax} />
          <Text style={[type.body, styles.message]} accessibilityLiveRegion="polite">
            {t(failMessageKey(state.reason, Platform.OS === 'web'))}
          </Text>
          <View style={styles.actions}>
            {state.reason === 'unavailable' ? (
              <Button label={t('add.useAnyway')} onPress={() => dispatch({ type: 'useAnyway' })} />
            ) : (
              <>
                {state.reason === 'noSubject' ? (
                  <Button label={t('add.retake')} onPress={retake} />
                ) : (
                  <Button label={t('add.retry')} onPress={() => dispatch({ type: 'retry' })} />
                )}
                <Button label={t('add.useAnyway')} variant="secondary" onPress={() => dispatch({ type: 'useAnyway' })} />
                {state.reason !== 'noSubject' && <Button label={t('add.retake')} variant="text" onPress={retake} />}
              </>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shelf: { backgroundColor: colors.tile },
  screen: { flex: 1, backgroundColor: colors.paper },
  padded: { paddingHorizontal: SIDE },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space(8),
    paddingBottom: space(16),
  },
  frame: {
    width: '100%',
    aspectRatio: 4 / 5,
    alignSelf: 'center',
    borderRadius: radius.stage,
    overflow: 'hidden',
    backgroundColor: colors.tile,
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  dim: { backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  message: { gap: space(4), paddingTop: space(16) },
  actions: { gap: space(12), paddingTop: space(24), paddingBottom: space(8) },
  reviewContent: { paddingHorizontal: SIDE, paddingBottom: space(24), gap: space(24) },
  stage: { padding: STAGE_PADDING, alignItems: 'center', justifyContent: 'center' },
  cutout: { alignSelf: 'stretch', flex: 1 },
  original: { borderRadius: radius.tile, overflow: 'hidden' },
  bottomBar: {
    paddingHorizontal: space(24),
    paddingTop: space(12),
    paddingBottom: space(8),
    gap: space(8),
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  error: { color: colors.danger },
  tools: { flexDirection: 'row', gap: space(12), marginTop: -space(12) },
  tool: { flex: 1 },
  toolNote: { alignItems: 'center', gap: space(4), marginTop: -space(16) },
});
