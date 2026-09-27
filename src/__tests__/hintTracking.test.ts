import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../lib/analytics', () => ({ track: vi.fn() }));

import { track } from '../lib/analytics';
import { trackHint } from '../lib/hints';
import { useHintQueue } from '../hooks/useHintQueue';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
} as any;

const trackMock = vi.mocked(track);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The hook's callbacks from a guest render (effects do not run on the server, so no timers) */
function renderQueue() {
  let result!: ReturnType<typeof useHintQueue>;
  function Probe() {
    result = useHintQueue({ userId: null, blocked: false, isBusy: () => false, canShow: () => true });
    return null;
  }
  renderToString(createElement(Probe));
  return result;
}

beforeEach(() => {
  store.clear();
  trackMock.mockClear();
});

describe('trackHint', () => {
  it('sends only the hint key for shown and dismissed', () => {
    trackHint('export-ai', 'shown');
    trackHint('export-ai', 'dismissed');
    expect(trackMock.mock.calls).toEqual([
      ['hint_shown', { hint: 'export-ai' }],
      ['hint_dismissed', { hint: 'export-ai' }],
    ]);
  });

  it('sends the hint key and where it was used from', () => {
    trackHint('export-ai', 'used', 'bubble');
    trackHint('export-ai', 'used', 'direct');
    expect(trackMock.mock.calls).toEqual([
      ['hint_used', { hint: 'export-ai', source: 'bubble' }],
      ['hint_used', { hint: 'export-ai', source: 'direct' }],
    ]);
  });
});

describe('useHintQueue tracking', () => {
  it('using a hint from its bubble sends hint_used with source bubble', async () => {
    renderQueue().markUsed('export-ai', 'bubble');
    await flush();
    expect(trackMock.mock.calls).toEqual([['hint_used', { hint: 'export-ai', source: 'bubble' }]]);
  });

  it('using it from its usual control twice sends a single hint_used', async () => {
    const queue = renderQueue();
    queue.markUsed('share-board', 'direct');
    queue.markUsed('share-board', 'direct');
    await flush();
    expect(trackMock.mock.calls).toEqual([['hint_used', { hint: 'share-board', source: 'direct' }]]);
  });

  it('using it from the bubble and then directly sends a single hint_used', async () => {
    const queue = renderQueue();
    queue.markUsed('export-ai', 'bubble');
    queue.markUsed('export-ai', 'direct');
    await flush();
    expect(trackMock.mock.calls).toEqual([['hint_used', { hint: 'export-ai', source: 'bubble' }]]);
  });

  it('each hint counts its own first use', async () => {
    const queue = renderQueue();
    queue.markUsed('board-search', 'direct');
    queue.markUsed('version-history', 'direct');
    await flush();
    expect(trackMock.mock.calls).toEqual([
      ['hint_used', { hint: 'board-search', source: 'direct' }],
      ['hint_used', { hint: 'version-history', source: 'direct' }],
    ]);
  });

  it('saves the use right away, before the tracking decision', () => {
    renderQueue().markUsed('export-ai', 'direct');
    expect(JSON.parse(store.get('heeey_hints') ?? '{}')['export-ai']?.usedAt).toBeTruthy();
  });

  it('does not send hint_used again once the hint is marked as used', async () => {
    renderQueue().markUsed('export-ai', 'direct');
    await flush();
    trackMock.mockClear();
    renderQueue().markUsed('export-ai', 'direct');
    await flush();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('dismissing or hiding with no hint on screen sends nothing', async () => {
    const queue = renderQueue();
    queue.dismiss();
    queue.hide();
    await flush();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
