import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../lib/analytics', () => ({ track: vi.fn() }));

import { track } from '../lib/analytics';
import { trackHint } from '../lib/hints';
import { useHint } from '../hooks/useHint';

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
function renderHint(hintKey = 'export-ai') {
  let result!: ReturnType<typeof useHint>;
  function Probe() {
    result = useHint(hintKey, { userId: null, blocked: false, canShow: () => true });
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
    trackHint('export-ai', 'used', 'menu');
    expect(trackMock.mock.calls).toEqual([
      ['hint_used', { hint: 'export-ai', source: 'bubble' }],
      ['hint_used', { hint: 'export-ai', source: 'menu' }],
    ]);
  });
});

describe('useHint tracking', () => {
  it('dismissing sends hint_dismissed once, with only the hint key', async () => {
    renderHint().dismiss();
    await flush();
    expect(trackMock.mock.calls).toEqual([['hint_dismissed', { hint: 'export-ai' }]]);
  });

  it('using it from the bubble sends hint_used with source bubble', async () => {
    renderHint().markUsed('bubble');
    await flush();
    expect(trackMock.mock.calls).toEqual([['hint_used', { hint: 'export-ai', source: 'bubble' }]]);
  });

  it('using it from the menu twice sends a single hint_used', async () => {
    const hint = renderHint();
    hint.markUsed('menu');
    hint.markUsed('menu');
    await flush();
    expect(trackMock.mock.calls).toEqual([['hint_used', { hint: 'export-ai', source: 'menu' }]]);
  });

  it('using it from the bubble and then the menu sends a single hint_used', async () => {
    const hint = renderHint();
    hint.markUsed('bubble');
    hint.markUsed('menu');
    await flush();
    expect(trackMock.mock.calls).toEqual([['hint_used', { hint: 'export-ai', source: 'bubble' }]]);
  });

  it('saves the use right away, before the tracking decision', () => {
    renderHint().markUsed('menu');
    expect(JSON.parse(store.get('heeey_hints') ?? '{}')['export-ai']?.usedAt).toBeTruthy();
  });

  it('does not send hint_used again once the hint is marked as used', async () => {
    renderHint().markUsed('menu');
    await flush();
    trackMock.mockClear();
    renderHint().markUsed('menu');
    await flush();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('hiding it for now sends nothing', async () => {
    renderHint().hide();
    await flush();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
