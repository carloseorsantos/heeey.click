import { describe, it, expect } from 'vitest';
import { buildRestoredElements } from '../lib/boardVersions';

describe('buildRestoredElements', () => {
  const nonce = () => 42;

  it('bumps restored elements above the version currently on the canvas', () => {
    const current = [{ id: 'a', version: 10, x: 50 }];
    const version = [{ id: 'a', version: 3, x: 0 }];

    const [a] = buildRestoredElements(current, version, 1000, nonce);
    expect(a).toMatchObject({ id: 'a', x: 0, version: 11, versionNonce: 42, updated: 1000 });
  });

  it('deletes elements created after the version and brings back removed ones', () => {
    const current = [
      { id: 'kept', version: 2 },
      { id: 'new', version: 5 },
      { id: 'gone', version: 7, isDeleted: true },
    ];
    const version = [
      { id: 'kept', version: 1 },
      { id: 'gone', version: 4, isDeleted: false },
    ];

    const result = buildRestoredElements(current, version, 1000, nonce);
    const byId = Object.fromEntries(result.map((el) => [el.id, el]));

    expect(byId.kept.version).toBe(3);
    expect(byId.gone).toMatchObject({ isDeleted: false, version: 8 });
    expect(byId.new).toMatchObject({ isDeleted: true, version: 6 });
  });

  it('leaves already deleted elements that are not in the version untouched', () => {
    const current = [{ id: 'old', version: 9, isDeleted: true }];
    expect(buildRestoredElements(current, [], 1000, nonce)).toEqual([]);
  });
});
