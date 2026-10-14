import type { Category, ColorFamily, Formality, Warmth } from '@tenue/engine';
import type { PreparedPhoto } from '../photo/prepare';

export const RETRY_BASE_MS = 2000;
export const MAX_PREPARE_WAIT_MS = 2 * 60 * 1000;

export interface DraftTags {
  category: Category | null;
  colorFamily: ColorFamily | null;
  colorHex: string | null;
  warmth: Warmth;
  formality: Formality;
}

export interface PhotoSize {
  width: number;
  height: number;
}

export type FailReason = 'noSubject' | 'process' | 'notReady' | 'unavailable';

const FAIL_MESSAGE: Record<FailReason, string> = {
  noSubject: 'add.noSubject',
  process: 'add.processFailed',
  notReady: 'add.notReady',
  unavailable: 'add.unavailable',
};

export function failMessageKey(reason: FailReason, web: boolean): string {
  if (web && reason === 'unavailable') return 'add.unavailableWeb';
  return FAIL_MESSAGE[reason];
}

interface Meta {
  attempt: number;
  downloadingSince: number | null;
  downloadRetries: number;
  lastDownloadingAt: number | null;
  processRetried: boolean;
}

type Base = { cameraDenied: boolean; meta: Meta };

export type AddState = Base &
  (
    | { step: 'choose' }
    | { step: 'processing'; uri: string; size: PhotoSize | null; delayMs: number; preparing: boolean; attempt: number }
    | { step: 'review'; uri: string; size: PhotoSize | null; prepared: PreparedPhoto | null; tags: DraftTags }
    | { step: 'failed'; uri: string; size: PhotoSize | null; reason: FailReason }
  );

export type AddEvent =
  | { type: 'cameraDenied' }
  | { type: 'picked'; uri: string; size?: PhotoSize | null }
  | { type: 'processed'; prepared: PreparedPhoto }
  | { type: 'failed'; code: string; now: number }
  | { type: 'retry' }
  | { type: 'useAnyway' }
  | { type: 'retake' }
  | { type: 'edit'; patch: Partial<DraftTags> };

const DEFAULT_TAGS: DraftTags = {
  category: null,
  colorFamily: null,
  colorHex: null,
  warmth: 2,
  formality: 'casual',
};

const FRESH_META: Meta = {
  attempt: 0,
  downloadingSince: null,
  downloadRetries: 0,
  lastDownloadingAt: null,
  processRetried: false,
};

export const initialAddState: AddState = { step: 'choose', cameraDenied: false, meta: FRESH_META };

type Photo = { uri: string; size: PhotoSize | null };

function toProcessing(state: AddState, photo: Photo, delayMs: number, preparing: boolean, meta: Meta): AddState {
  const attempt = meta.attempt + 1;
  return {
    step: 'processing',
    uri: photo.uri,
    size: photo.size,
    delayMs,
    preparing,
    attempt,
    cameraDenied: state.cameraDenied,
    meta: { ...meta, attempt },
  };
}

function onFailure(state: AddState & { step: 'processing' }, code: string, now: number): AddState {
  const { meta } = state;
  const fail = (reason: FailReason, next: Meta = meta): AddState => ({
    step: 'failed',
    uri: state.uri,
    size: state.size,
    reason,
    cameraDenied: state.cameraDenied,
    meta: next,
  });

  if (code === 'ERR_NO_SUBJECT') return fail('noSubject');
  if (code === 'ERR_UNAVAILABLE') return fail('unavailable');

  if (code === 'ERR_MODEL_DOWNLOADING') {
    const since = meta.downloadingSince ?? now;
    const remaining = MAX_PREPARE_WAIT_MS - (now - since);
    const seen = { ...meta, downloadingSince: since, lastDownloadingAt: now };
    if (remaining <= 0) return fail('notReady', seen);
    const delay = Math.min(RETRY_BASE_MS * 2 ** meta.downloadRetries, remaining);
    return toProcessing(state, state, delay, true, { ...seen, downloadRetries: meta.downloadRetries + 1 });
  }

  const recentDownload = meta.lastDownloadingAt !== null && now - meta.lastDownloadingAt < MAX_PREPARE_WAIT_MS;
  if (code === 'ERR_PROCESS' && recentDownload && !meta.processRetried) {
    return toProcessing(state, state, RETRY_BASE_MS, state.preparing, { ...meta, processRetried: true });
  }
  return fail('process');
}

export function addItemReducer(state: AddState, event: AddEvent): AddState {
  switch (event.type) {
    case 'cameraDenied':
      return { ...state, cameraDenied: true };
    case 'picked':
      if (state.step !== 'choose') return state;
      return toProcessing(state, { uri: event.uri, size: event.size ?? null }, 0, false, { ...FRESH_META, lastDownloadingAt: state.meta.lastDownloadingAt });
    case 'processed':
      if (state.step !== 'processing') return state;
      return {
        step: 'review',
        uri: state.uri,
        size: state.size,
        prepared: event.prepared,
        tags: { ...DEFAULT_TAGS, ...event.prepared.tags },
        cameraDenied: state.cameraDenied,
        meta: state.meta,
      };
    case 'failed':
      if (state.step !== 'processing') return state;
      return onFailure(state, event.code, event.now);
    case 'retry':
      if (state.step !== 'failed' || state.reason === 'unavailable') return state;
      return toProcessing(state, state, 0, false, {
        ...state.meta,
        downloadingSince: null,
        downloadRetries: 0,
        processRetried: false,
      });
    case 'useAnyway':
      if (state.step !== 'failed') return state;
      return {
        step: 'review',
        uri: state.uri,
        size: state.size,
        prepared: null,
        tags: DEFAULT_TAGS,
        cameraDenied: state.cameraDenied,
        meta: state.meta,
      };
    case 'retake':
      return {
        step: 'choose',
        cameraDenied: state.cameraDenied,
        meta: { ...FRESH_META, attempt: state.meta.attempt, lastDownloadingAt: state.meta.lastDownloadingAt },
      };
    case 'edit':
      if (state.step !== 'review') return state;
      return { ...state, tags: { ...state.tags, ...event.patch } };
  }
}
