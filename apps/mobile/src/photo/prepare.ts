import { processPhoto } from '../../modules/tenue-photo';
import { deleteFile } from '../data/files';
import { toTags } from './tags';
import type { SuggestedTags } from './tags';
import { encodeWebp } from './webp';
import type { CutoutFormat, EncodedCutout } from './webp';

export { fitLongSide } from './fit';

export interface PreparedPhoto {
  cutoutUri: string;
  cutoutFormat: CutoutFormat;
  originalUri: string;
  tags: SuggestedTags;
}

export interface PrepareDeps {
  process?: typeof processPhoto;
  toWebp?: (uri: string, width: number, height: number) => Promise<EncodedCutout>;
  deleteFile?: (uri: string) => Promise<void>;
}

async function defaultDeleteFile(uri: string): Promise<void> {
  deleteFile(uri);
}

export async function preparePhoto(originalUri: string, deps: PrepareDeps = {}): Promise<PreparedPhoto> {
  const process = deps.process ?? processPhoto;
  const toWebp = deps.toWebp ?? encodeWebp;
  const deleteFile = deps.deleteFile ?? defaultDeleteFile;
  const processed = await process(originalUri);
  let encoded: EncodedCutout;
  try {
    encoded = await toWebp(processed.cutoutUri, processed.width, processed.height);
  } finally {
    await deleteFile(processed.cutoutUri).catch(() => undefined);
  }
  return { cutoutUri: encoded.uri, cutoutFormat: encoded.format, originalUri, tags: toTags(processed) };
}
