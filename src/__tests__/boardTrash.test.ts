import { describe, it, expect, vi, afterEach } from 'vitest';
import { BOARD_ID_HEADER, supabase } from '../lib/supabase';
import { setBoardTrashed, deleteBoardPermanently, fetchClaimedBoard } from '../lib/boardTrash';

function mockBoardsTable(result: { data: any; error: any }) {
  const chain: any = {
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    setHeader: vi.fn(() => chain),
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

  it('setBoardTrashed should name the board in the link header, so boards without an owner are reached', async () => {
    const chain = mockBoardsTable({ data: [{ id: 'guest-board' }], error: null });

    expect(await setBoardTrashed('guest-board', true)).toBe('saved');
    expect(await setBoardTrashed('guest-board', false)).toBe('saved');
    expect(chain.setHeader.mock.calls).toEqual([
      [BOARD_ID_HEADER, 'guest-board'],
      [BOARD_ID_HEADER, 'guest-board'],
    ]);
  });

  it('setBoardTrashed should report boards missing remotely and server errors', async () => {
    mockBoardsTable({ data: [], error: null });
    expect(await setBoardTrashed('local-only', true)).toBe('not-found');

    mockBoardsTable({ data: null, error: { message: 'Quadro na lixeira é somente leitura.' } });
    expect(await setBoardTrashed('b1', false)).toBe('error');
  });

  it('setBoardTrashed should tell a refused change apart from other server errors', async () => {
    mockBoardsTable({ data: null, error: { code: '42501', message: 'Apenas quem edita o quadro pelo time pode movê-lo para a lixeira ou restaurá-lo.' } });
    expect(await setBoardTrashed('claimed-by-a-team', true)).toBe('forbidden');
  });

  it('fetchClaimedBoard should return the board only when a team owns it now', async () => {
    const chain = mockBoardsTable({ data: null, error: null });
    chain.select = vi.fn(() => chain);
    chain.maybeSingle = vi.fn();

    chain.maybeSingle.mockResolvedValueOnce({ data: { id: 'b1', owner_id: 'u1', team_id: 't1' }, error: null });
    expect(await fetchClaimedBoard('b1')).toMatchObject({ id: 'b1', team_id: 't1' });
    expect(chain.setHeader).toHaveBeenCalledWith(BOARD_ID_HEADER, 'b1');

    chain.maybeSingle.mockResolvedValueOnce({ data: { id: 'b1', owner_id: null, team_id: null }, error: null });
    expect(await fetchClaimedBoard('b1')).toBeNull();
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchClaimedBoard('restricted-or-missing')).toBeNull();
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    expect(await fetchClaimedBoard('b1')).toBeNull();
    chain.maybeSingle.mockRejectedValueOnce(new Error('network'));
    expect(await fetchClaimedBoard('b1')).toBeNull();
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
