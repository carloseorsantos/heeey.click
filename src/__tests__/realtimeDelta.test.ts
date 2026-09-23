import { describe, it, expect } from 'vitest';
import {
  pruneStaleTombstones,
  takeChangedElements,
  takeChangedFiles,
  TOMBSTONE_MAX_AGE_MS,
} from '../lib/realtimeUtils';

describe('realtime delta helpers', () => {
  it('pruneStaleTombstones keeps live and recently deleted elements', () => {
    const now = 10 * TOMBSTONE_MAX_AGE_MS;
    const elements = [
      { id: 'live', isDeleted: false, updated: 0 },
      { id: 'recent', isDeleted: true, updated: now - 1000 },
      { id: 'stale', isDeleted: true, updated: now - TOMBSTONE_MAX_AGE_MS - 1 },
      { id: 'no-timestamp', isDeleted: true },
    ];
    expect(pruneStaleTombstones(elements, now).map((e) => e.id)).toEqual([
      'live',
      'recent',
      'no-timestamp',
    ]);
  });

  it('takeChangedElements sends each element version only once', () => {
    const sent = new Map<string, number>();
    const v1 = [
      { id: 'a', version: 1 },
      { id: 'b', version: 1 },
    ];
    expect(takeChangedElements(v1, sent).map((e) => e.id)).toEqual(['a', 'b']);
    expect(takeChangedElements(v1, sent)).toEqual([]);

    const v2 = [
      { id: 'a', version: 2 },
      { id: 'b', version: 1 },
      { id: 'c', version: 1 },
    ];
    expect(takeChangedElements(v2, sent).map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('takeChangedFiles re-sends a file once its storage URL is known', () => {
    const sent = new Map<string, string>();
    expect(takeChangedFiles({ f1: { id: 'f1' } }, sent)).toEqual({ f1: { id: 'f1' } });
    expect(takeChangedFiles({ f1: { id: 'f1' } }, sent)).toBeUndefined();

    const uploaded = { f1: { id: 'f1', dataURL: 'https://cdn/f1.webp' } };
    expect(takeChangedFiles(uploaded, sent)).toEqual(uploaded);
    expect(takeChangedFiles(uploaded, sent)).toBeUndefined();
    expect(takeChangedFiles(undefined, sent)).toBeUndefined();
  });
});
