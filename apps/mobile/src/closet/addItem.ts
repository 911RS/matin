import type { QueryClient } from '@tanstack/react-query';
import type { ItemRow } from '@tenue/backend';
import type { Category, ColorFamily, Formality, Warmth } from '@tenue/engine';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { enqueue } from '../data/mutations';
import type { UploadImageVars } from '../data/mutations';
import type { Repo } from '../data/repo';
import { fitLongSide } from '../photo/prepare';
import type { PreparedPhoto } from '../photo/prepare';
import type { PhotoSize } from './addItemReducer';
import { pendingFiles, removeFile } from './pending';
import type { PendingFiles } from './pending';

const ORIGINAL_MAX_SIDE = 2048;
const JPEG_QUALITY = 0.85;

export interface SaveDeps {
  repo: Repo;
  queryClient: QueryClient;
  newId: () => string;
  pending?: PendingFiles;
  toJpeg?: (uri: string, size: PhotoSize | null) => Promise<string>;
  deleteTemp?: (uri: string) => void;
}

export interface NewItemInput {
  prepared: (Pick<PreparedPhoto, 'cutoutUri' | 'originalUri'> & { cutoutFormat?: PreparedPhoto['cutoutFormat'] }) | { originalUri: string; cutoutUri: null };
  category: Category;
  colorFamily: ColorFamily;
  colorHex: string;
  warmth: Warmth;
  formality: Formality;
  originalSize?: PhotoSize | null;
}

export async function reencodeOriginal(uri: string, known: PhotoSize | null = null): Promise<string> {
  let image;
  if (known) {
    const context = ImageManipulator.manipulate(uri);
    const size = fitLongSide(known.width, known.height, ORIGINAL_MAX_SIDE);
    if (size) context.resize(size);
    image = await context.renderAsync();
  } else {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    const size = fitLongSide(probe.width, probe.height, ORIGINAL_MAX_SIDE);
    image = size ? await ImageManipulator.manipulate(uri).resize(size).renderAsync() : probe;
  }
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return saved.uri;
}

export async function saveNewItem(deps: SaveDeps, input: NewItemInput): Promise<ItemRow> {
  const pending = deps.pending ?? pendingFiles;
  const toJpeg = deps.toJpeg ?? reencodeOriginal;
  const userId = await deps.repo.userId();
  if (!userId) throw new Error('No user');

  const id = deps.newId();
  const originalPath = `${userId}/${id}-original.jpg`;
  const png = 'cutoutFormat' in input.prepared && input.prepared.cutoutFormat === 'png';
  const cutoutPath = input.prepared.cutoutUri ? `${userId}/${id}.${png ? 'png' : 'webp'}` : null;

  const deleteTemp = deps.deleteTemp ?? removeFile;
  const uploads: UploadImageVars[] = [];
  try {
    if (input.prepared.cutoutUri && cutoutPath) {
      await pending.copy(input.prepared.cutoutUri, cutoutPath);
      uploads.push({ path: cutoutPath, contentType: png ? 'image/png' : 'image/webp' });
    }
    const jpeg = await toJpeg(input.prepared.originalUri, input.originalSize ?? null);
    try {
      await pending.copy(jpeg, originalPath);
    } finally {
      deleteTemp(jpeg);
    }
    uploads.push({ path: originalPath, contentType: 'image/jpeg' });
  } catch (error) {
    for (const path of [cutoutPath, originalPath]) if (path) pending.remove(path);
    throw error;
  }

  const row: ItemRow = {
    id,
    user_id: userId,
    category: input.category,
    color_hex: input.colorHex,
    color_family: input.colorFamily,
    warmth: input.warmth,
    formality: input.formality,
    image_path: cutoutPath ?? originalPath,
    original_path: originalPath,
    archived_at: null,
    unavailable_until: null,
  };

  for (const vars of uploads) enqueue(deps.queryClient, 'uploadImage', vars);
  enqueue(deps.queryClient, 'saveItem', row);
  return row;
}
