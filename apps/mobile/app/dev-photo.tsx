import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { processPhoto } from '../modules/tenue-photo';
import type { ProcessedPhoto } from '../modules/tenue-photo';
import { errorCode } from '../src/photo/errors';
import { preparePhoto } from '../src/photo/prepare';
import type { PreparedPhoto } from '../src/photo/prepare';

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; uri: string }
  | {
      kind: 'done';
      uri: string;
      photo: PreparedPhoto;
      native: ProcessedPhoto;
      size: { width: number; height: number } | null;
      ms: number;
    }
  | { kind: 'failed'; uri: string; code: string; message: string; ms: number };

const CHECKER = 16;
const CHECKER_COLS = 20;
const CHECKER_ROWS = 20;

function Checkerboard() {
  const rows = [];
  for (let r = 0; r < CHECKER_ROWS; r++) {
    const cells = [];
    for (let c = 0; c < CHECKER_COLS; c++) {
      cells.push(
        <View key={c} style={[styles.cell, (r + c) % 2 === 0 ? styles.cellLight : styles.cellDark]} />,
      );
    }
    rows.push(
      <View key={r} style={styles.row}>
        {cells}
      </View>,
    );
  }
  return <View style={StyleSheet.absoluteFill}>{rows}</View>;
}

export default function DevPhoto() {
  const params = useLocalSearchParams<{ uri?: string; run?: string }>();
  const [state, setState] = useState<RunState>({ kind: 'idle' });

  const run = useCallback(async (uri: string) => {
    setState({ kind: 'running', uri });
    const started = Date.now();
    const captured: { native?: ProcessedPhoto } = {};
    const process = async (input: string) => {
      captured.native = await processPhoto(input);
      return captured.native;
    };
    try {
      const photo = await preparePhoto(uri, { process });
      const native = captured.native;
      if (!native) throw new Error('No native result');
      const ms = Date.now() - started;
      const size = await Image.loadAsync(photo.cutoutUri)
        .then((ref) => ({ width: ref.width, height: ref.height }))
        .catch(() => null);
      console.log(`[dev-photo] ${JSON.stringify({ uri, ok: true, ms, size, native, ...photo })}`);
      setState({ kind: 'done', uri, photo, native, size, ms });
    } catch (error) {
      const ms = Date.now() - started;
      const code = errorCode(error);
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[dev-photo] ${JSON.stringify({ uri, ok: false, ms, code, message })}`);
      setState({ kind: 'failed', uri, code, message, ms });
    }
  }, []);

  useEffect(() => {
    if (params.uri) void run(params.uri);
  }, [params.uri, params.run, run]);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled && result.assets[0]) await run(result.assets[0].uri);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={pick}
        disabled={state.kind === 'running'}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Pick photo</Text>
      </Pressable>

      {state.kind === 'running' && <Text style={styles.line}>Processing…</Text>}

      {state.kind === 'failed' && (
        <View style={styles.result}>
          <Text style={styles.error}>{state.code}</Text>
          <Text style={styles.line}>{state.message}</Text>
          <Text style={styles.meta}>{state.ms} ms</Text>
        </View>
      )}

      {state.kind === 'done' && (
        <View style={styles.result}>
          <View style={styles.preview}>
            <Checkerboard />
            <Image source={{ uri: state.photo.cutoutUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
          </View>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: state.photo.tags.colorHex }]} />
            <Text style={styles.line}>
              {state.photo.tags.colorHex} · {state.photo.tags.colorFamily}
            </Text>
          </View>
          <Text style={styles.line}>Category: {state.photo.tags.category ?? 'none'}</Text>
          <Text style={styles.line}>
            Labels: {state.native.labels.length > 0 ? state.native.labels.join(', ') : 'none'}
          </Text>
          <Text style={styles.line}>
            Cut-out: {state.native.width}×{state.native.height} PNG,{' '}
            {state.size ? `${state.size.width}×${state.size.height}` : 'unknown'} WebP · {state.ms} ms
          </Text>
          <Text style={styles.meta}>{state.photo.cutoutUri}</Text>
        </View>
      )}

      {state.kind !== 'idle' && <Text style={styles.meta}>{state.uri}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 16 },
  button: { backgroundColor: '#111', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  result: { gap: 8 },
  preview: {
    width: CHECKER * CHECKER_COLS,
    height: CHECKER * CHECKER_ROWS,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  cell: { width: CHECKER, height: CHECKER },
  cellLight: { backgroundColor: '#e6e6e6' },
  cellDark: { backgroundColor: '#bdbdbd' },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 6, borderWidth: 1, borderColor: '#0003' },
  line: { fontSize: 15 },
  error: { fontSize: 18, fontWeight: '700', color: '#b00020' },
  meta: { fontSize: 12, color: '#666' },
});
