import { describe, it, expect, vi, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';
import { setBoardTrashed, deleteBoardPermanently } from '../lib/boardTrash';

function mockBoardsTable(result: { data: any; error: any }) {
  const chain: any = {
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn().mockResolvedValue(result),
  };
  vi.spyOn(supabase, 'from').mockReturnValue(chain);
  return chain;
}

describe('boardTrash', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setBoardTrashed should set deleted_at when trashing and clear it when restoring', async () => {
    const chain = mockBoardsTable({ data: [{ id: 'b1' }], error: null });

    expect(await setBoardTrashed('b1', true)).toBe('saved');
    expect(chain.update.mock.calls[0][0].deleted_at).toEqual(expect.any(String));

    expect(await setBoardTrashed('b1', false)).toBe('saved');
    expect(chain.update.mock.calls[1][0]).toEqual({ deleted_at: null });
    expect(chain.eq).toHaveBeenCalledWith('id', 'b1');
  });

  it('setBoardTrashed should report boards missing remotely and server errors', async () => {
    mockBoardsTable({ data: [], error: null });
    expect(await setBoardTrashed('local-only', true)).toBe('not-found');

    mockBoardsTable({ data: null, error: { message: 'Quadro na lixeira é somente leitura.' } });
    expect(await setBoardTrashed('b1', false)).toBe('error');
  });

  it('deleteBoardPermanently should remove the board images before the row', async () => {
    const calls: string[] = [];
    const remove = vi.fn(async () => {
      calls.push('storage');
      return { data: [], error: null };
    });
    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [{ name: 'img-1.webp' }, { name: 'img-2.webp' }], error: null }),
      remove,
    } as any);
    const chain = mockBoardsTable({ data: [{ id: 'b1' }], error: null });
    chain.select.mockImplementation(async () => {
      calls.push('row');
      return { data: [{ id: 'b1' }], error: null };
    });

    expect(await deleteBoardPermanently('b1')).toBe(true);
    expect(remove).toHaveBeenCalledWith(['b1/img-1.webp', 'b1/img-2.webp']);
    expect(calls).toEqual(['storage', 'row']);
  });

  it('deleteBoardPermanently should fail when RLS blocks the delete', async () => {
    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn(),
    } as any);
    mockBoardsTable({ data: [], error: null });

    expect(await deleteBoardPermanently('someone-elses-board')).toBe(false);
  });
});
