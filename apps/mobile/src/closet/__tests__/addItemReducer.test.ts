import type { PreparedPhoto } from '../../photo/prepare';
import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import { addItemReducer, failMessageKey, initialAddState, MAX_PREPARE_WAIT_MS } from '../addItemReducer';
import type { AddEvent, AddState } from '../addItemReducer';

const prepared: PreparedPhoto = {
  cutoutUri: 'file:///cache/cut.webp',
  cutoutFormat: 'webp',
  originalUri: 'file:///orig.jpg',
  tags: { category: 'top', colorFamily: 'navy', colorHex: '#1f2a44' },
};

function run(events: AddEvent[], from: AddState = initialAddState): AddState {
  return events.reduce(addItemReducer, from);
}

function processing(state: AddState) {
  if (state.step !== 'processing') throw new Error(`expected processing, got ${state.step}`);
  return state;
}

describe('addItemReducer', () => {
  it('starts on choose and moves to processing when a photo is picked', () => {
    expect(initialAddState.step).toBe('choose');
    const state = processing(run([{ type: 'picked', uri: 'file:///a.jpg' }]));
    expect(state).toMatchObject({ uri: 'file:///a.jpg', delayMs: 0, preparing: false });
  });

  it('remembers a denied camera across steps', () => {
    const state = run([{ type: 'cameraDenied' }, { type: 'picked', uri: 'file:///a.jpg' }, { type: 'retake' }]);
    expect(state).toMatchObject({ step: 'choose', cameraDenied: true });
  });

  it('goes to review with tags from the photo and default warmth and formality', () => {
    const state = run([{ type: 'picked', uri: 'file:///orig.jpg' }, { type: 'processed', prepared }]);
    expect(state).toMatchObject({
      step: 'review',
      prepared,
      tags: { category: 'top', colorFamily: 'navy', colorHex: '#1f2a44', warmth: 2, formality: 'casual' },
    });
  });

  it('fails with Retake / Use anyway on ERR_NO_SUBJECT', () => {
    const state = run([
      { type: 'picked', uri: 'file:///a.jpg' },
      { type: 'failed', code: 'ERR_NO_SUBJECT', now: 0 },
    ]);
    expect(state).toMatchObject({ step: 'failed', reason: 'noSubject', uri: 'file:///a.jpg' });
  });

  it('fails as unavailable on ERR_UNAVAILABLE and offers the photo as is', () => {
    const failed = run([
      { type: 'picked', uri: 'file:///a.jpg' },
      { type: 'failed', code: 'ERR_UNAVAILABLE', now: 0 },
    ]);
    expect(failed).toMatchObject({ step: 'failed', reason: 'unavailable', uri: 'file:///a.jpg' });
    expect(addItemReducer(failed, { type: 'retry' })).toBe(failed);
    expect(addItemReducer(failed, { type: 'useAnyway' })).toMatchObject({ step: 'review', prepared: null });
  });

  it('retries ERR_MODEL_DOWNLOADING with doubling delays while preparing', () => {
    let state = run([{ type: 'picked', uri: 'file:///a.jpg' }]);
    const delays: number[] = [];
    let now = 1000;
    for (let i = 0; i < 4; i++) {
      state = processing(addItemReducer(state, { type: 'failed', code: 'ERR_MODEL_DOWNLOADING', now }));
      expect(state.preparing).toBe(true);
      delays.push(state.delayMs);
      now += state.delayMs;
    }
    expect(delays).toEqual([2000, 4000, 8000, 16000]);
  });

  it('caps the downloading wait at two minutes, then offers Use anyway', () => {
    let state = run([{ type: 'picked', uri: 'file:///a.jpg' }]);
    let now = 0;
    let waited = 0;
    for (;;) {
      state = addItemReducer(state, { type: 'failed', code: 'ERR_MODEL_DOWNLOADING', now });
      if (state.step !== 'processing') break;
      waited += state.delayMs;
      now += state.delayMs;
    }
    expect(waited).toBe(MAX_PREPARE_WAIT_MS);
    expect(state).toMatchObject({ step: 'failed', reason: 'notReady' });
  });

  it('gives a manual retry a fresh downloading window', () => {
    let state = run([{ type: 'picked', uri: 'file:///a.jpg' }]);
    state = addItemReducer(state, { type: 'failed', code: 'ERR_MODEL_DOWNLOADING', now: 0 });
    state = addItemReducer(state, { type: 'failed', code: 'ERR_MODEL_DOWNLOADING', now: MAX_PREPARE_WAIT_MS });
    expect(state.step).toBe('failed');
    state = processing(addItemReducer(state, { type: 'retry' }));
    expect(state.delayMs).toBe(0);
    state = processing(addItemReducer(state, { type: 'failed', code: 'ERR_MODEL_DOWNLOADING', now: 200_000 }));
    expect(state.delayMs).toBe(2000);
  });

  it('fails with Retry / Use anyway on ERR_PROCESS without a recent download', () => {
    const state = run([{ type: 'picked', uri: 'file:///a.jpg' }, { type: 'failed', code: 'ERR_PROCESS', now: 0 }]);
    expect(state).toMatchObject({ step: 'failed', reason: 'process' });
  });

  it('retries ERR_PROCESS once when a download was seen in the last two minutes', () => {
    let state = run([
      { type: 'picked', uri: 'file:///a.jpg' },
      { type: 'failed', code: 'ERR_MODEL_DOWNLOADING', now: 0 },
    ]);
    state = processing(addItemReducer(state, { type: 'failed', code: 'ERR_PROCESS', now: 2000 }));
    expect(state.delayMs).toBeGreaterThan(0);
    state = addItemReducer(state, { type: 'failed', code: 'ERR_PROCESS', now: 5000 });
    expect(state).toMatchObject({ step: 'failed', reason: 'process' });
  });

  it('does not auto-retry ERR_PROCESS when the download was more than two minutes ago', () => {
    let state = run([
      { type: 'picked', uri: 'file:///a.jpg' },
      { type: 'failed', code: 'ERR_MODEL_DOWNLOADING', now: 0 },
    ]);
    state = addItemReducer(state, { type: 'failed', code: 'ERR_PROCESS', now: MAX_PREPARE_WAIT_MS + 1 });
    expect(state).toMatchObject({ step: 'failed', reason: 'process' });
  });

  it('treats unknown errors like ERR_PROCESS', () => {
    const state = run([{ type: 'picked', uri: 'file:///a.jpg' }, { type: 'failed', code: 'ERR_UNKNOWN', now: 0 }]);
    expect(state).toMatchObject({ step: 'failed', reason: 'process' });
  });

  it('Use anyway goes to review with the original photo and no tags', () => {
    const state = run([
      { type: 'picked', uri: 'file:///a.jpg' },
      { type: 'failed', code: 'ERR_NO_SUBJECT', now: 0 },
      { type: 'useAnyway' },
    ]);
    expect(state).toMatchObject({
      step: 'review',
      uri: 'file:///a.jpg',
      prepared: null,
      tags: { category: null, colorFamily: null, colorHex: null, warmth: 2, formality: 'casual' },
    });
  });

  it('edits tags in review and ignores edits elsewhere', () => {
    const review = run([{ type: 'picked', uri: 'file:///orig.jpg' }, { type: 'processed', prepared }]);
    const edited = addItemReducer(review, { type: 'edit', patch: { warmth: 3, category: 'outerwear' } });
    expect(edited).toMatchObject({ tags: { warmth: 3, category: 'outerwear', colorFamily: 'navy' } });
    expect(addItemReducer(initialAddState, { type: 'edit', patch: { warmth: 3 } })).toBe(initialAddState);
  });

  it('ignores late results once the user has moved on', () => {
    const chose = run([{ type: 'picked', uri: 'file:///a.jpg' }, { type: 'retake' }]);
    expect(addItemReducer(chose, { type: 'processed', prepared })).toBe(chose);
    expect(addItemReducer(chose, { type: 'failed', code: 'ERR_PROCESS', now: 0 })).toBe(chose);
  });

  it('bumps the attempt on every processing entry', () => {
    const first = processing(run([{ type: 'picked', uri: 'file:///a.jpg' }]));
    const second = processing(addItemReducer(first, { type: 'failed', code: 'ERR_MODEL_DOWNLOADING', now: 0 }));
    expect(second.attempt).toBeGreaterThan(first.attempt);
  });

  it('keeps the picker size through failure and Use anyway', () => {
    const size = { width: 3000, height: 4000 };
    const state = run([
      { type: 'picked', uri: 'file:///a.jpg', size },
      { type: 'failed', code: 'ERR_NO_SUBJECT', now: 0 },
      { type: 'useAnyway' },
    ]);
    expect(state).toMatchObject({ step: 'review', size });
  });
});

describe('failMessageKey', () => {
  it('uses browser copy for an unavailable photo tool on web only', () => {
    expect(failMessageKey('unavailable', true)).toBe('add.unavailableWeb');
    expect(failMessageKey('unavailable', false)).toBe('add.unavailable');
    expect(failMessageKey('notReady', true)).toBe('add.notReady');
    expect(failMessageKey('noSubject', true)).toBe('add.noSubject');
    expect(failMessageKey('process', false)).toBe('add.processFailed');
  });

  it('has the web copy in both languages', () => {
    expect(en.add.unavailableWeb).toBe(
      "Background removal isn't supported in this browser. You can still save the photo as is.",
    );
    expect(fr.add.unavailableWeb).toMatch(/navigateur/);
  });
});

describe('addItemReducer adjustments', () => {
  function review(state: AddState) {
    if (state.step !== 'review') throw new Error(`expected review, got ${state.step}`);
    return state;
  }
  const toReview: AddEvent[] = [
    { type: 'picked', uri: 'file:///orig.jpg', size: { width: 3000, height: 4000 } },
    { type: 'processed', prepared },
  ];
  const rotated: AddEvent = {
    type: 'adjusted',
    uri: 'file:///cache/orig-r.jpg',
    size: { width: 4000, height: 3000 },
    cutoutUri: 'file:///cache/cut-r.png',
  };

  it('swaps in the edited photo and cut-out, as PNG, and keeps the tags', () => {
    const before = review(run([...toReview, { type: 'edit', patch: { warmth: 3 } }]));
    const after = review(addItemReducer(before, rotated));
    expect(after.uri).toBe('file:///cache/orig-r.jpg');
    expect(after.size).toEqual({ width: 4000, height: 3000 });
    expect(after.prepared).toMatchObject({ cutoutUri: 'file:///cache/cut-r.png', cutoutFormat: 'png', originalUri: 'file:///cache/orig-r.jpg' });
    expect(after.tags).toEqual(before.tags);
  });

  it('remembers the first version so reset brings it back after several edits', () => {
    const second: AddEvent = { ...rotated, uri: 'file:///cache/orig-c.jpg', cutoutUri: 'file:///cache/cut-c.png' };
    const edited = review(run([...toReview, rotated, second]));
    expect(edited.pristine).toMatchObject({ uri: 'file:///orig.jpg', prepared });
    const reset = review(addItemReducer(edited, { type: 'resetAdjust' }));
    expect(reset.uri).toBe('file:///orig.jpg');
    expect(reset.size).toEqual({ width: 3000, height: 4000 });
    expect(reset.prepared).toEqual(prepared);
    expect(reset.pristine).toBeUndefined();
  });

  it('edits only the photo when there is no cut-out', () => {
    const plain = review(
      run([
        { type: 'picked', uri: 'file:///orig.jpg' },
        { type: 'failed', code: 'ERR_NO_SUBJECT', now: 0 },
        { type: 'useAnyway' },
        { ...rotated, cutoutUri: null },
      ]),
    );
    expect(plain.uri).toBe('file:///cache/orig-r.jpg');
    expect(plain.prepared).toBeNull();
  });

  it('ignores edits and resets outside review', () => {
    expect(addItemReducer(initialAddState, rotated)).toBe(initialAddState);
    const fresh = review(run(toReview));
    expect(addItemReducer(fresh, { type: 'resetAdjust' })).toBe(fresh);
  });
});
