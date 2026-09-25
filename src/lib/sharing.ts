import { BOARD_ID_HEADER, supabase } from './supabase';
import { AccessLevel, Board, Permission } from './types';
import { TeamError } from './teams';

/** What the current user can do on a board, as computed by the database */
export interface BoardAccess {
  exists: boolean;
  /** null: no access (the board exists but is restricted, or does not exist) */
  permission: Permission | null;
  member_permission?: Permission | null;
  can_share?: boolean;
  can_trash?: boolean;
  can_delete?: boolean;
  can_move?: boolean;
  is_creator?: boolean;
  access_level?: AccessLevel;
  restrict_link_at?: string | null;
  team?: { id: string; name: string; slug: string | null; is_personal: boolean; is_member: boolean } | null;
  project?: { id: string; name: string; visibility: 'team' | 'private'; is_default: boolean } | null;
}

export interface BoardShare {
  id: string;
  email: string;
  role: 'edit' | 'view';
  is_you: boolean;
}

export interface BoardSharing {
  can_share: boolean;
  my_permission: Permission;
  access_level: AccessLevel;
  restrict_link_at: string | null;
  creator: { user_id: string; name: string | null; email: string | null; is_you: boolean } | null;
  team: { id: string; name: string; is_personal: boolean; editors_can_share: boolean; member_count: number } | null;
  project: { id: string; name: string; visibility: 'team' | 'private'; is_default: boolean; member_count: number | null } | null;
  members: BoardShare[];
}

/** null when the request failed (offline, database without the teams migration) */
export async function fetchBoardAccess(boardId: string): Promise<BoardAccess | null> {
  const { data, error } = await supabase.rpc('get_board_access', { p_board_id: boardId }).setHeader(BOARD_ID_HEADER, boardId);
  if (error || !data) return null;
  return data as BoardAccess;
}

export async function fetchBoardSharing(boardId: string): Promise<BoardSharing> {
  const { data, error } = await supabase.rpc('board_sharing', { p_board_id: boardId });
  if (error) throw new TeamError(error.message);
  return data as BoardSharing;
}

export async function shareBoard(boardId: string, email: string, role: BoardShare['role']): Promise<void> {
  const { error } = await supabase.rpc('share_board', { p_board_id: boardId, p_email: email.trim(), p_role: role });
  if (error) throw new TeamError(error.message);
}

export async function updateBoardShare(memberId: string, role: BoardShare['role']): Promise<void> {
  const { error } = await supabase.rpc('update_board_share', { p_member_id: memberId, p_role: role });
  if (error) throw new TeamError(error.message);
}

export async function removeBoardShare(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_board_share', { p_member_id: memberId });
  if (error) throw new TeamError(error.message);
}

export async function keepBoardLinkOpen(boardId: string): Promise<void> {
  const { error } = await supabase.rpc('keep_board_link_open', { p_board_id: boardId });
  if (error) throw new TeamError(error.message);
}

/** Moves a board to another project (and folder); between teams it needs admin rights on both */
export async function moveBoard(boardId: string, projectId: string, folderId: string | null = null): Promise<Pick<Board, 'team_id' | 'project_id' | 'folder_id'>> {
  const { data, error } = await supabase.rpc('move_board', { p_board_id: boardId, p_project_id: projectId, p_folder_id: folderId });
  if (error) throw new TeamError(error.message);
  return data as Pick<Board, 'team_id' | 'project_id' | 'folder_id'>;
}

/**
 * Claims a board created without an account into a project. 'not-found' means the board is
 * not in the database (it only exists in this browser), so the caller inserts it instead.
 */
export async function claimBoard(
  boardId: string,
  projectId: string,
  accessLevel: 'edit' | 'restricted'
): Promise<'claimed' | 'not-found'> {
  const { error } = await supabase
    .rpc('claim_board', { p_board_id: boardId, p_project_id: projectId, p_access_level: accessLevel })
    .setHeader(BOARD_ID_HEADER, boardId);
  if (!error) return 'claimed';
  if (/não encontrado/i.test(error.message)) return 'not-found';
  throw new TeamError(error.message);
}

/** Columns the app may write when inserting a board (the rest is set by the database) */
export function toBoardInsert(board: Board) {
  return {
    id: board.id,
    title: board.title,
    owner_id: board.owner_id,
    elements: board.elements,
    app_state: board.app_state,
    files: board.files,
    access_level: board.access_level,
    created_at: board.created_at,
    updated_at: board.updated_at,
    ...(board.thumbnail !== undefined ? { thumbnail: board.thumbnail } : {}),
    ...(board.folder_id ? { folder_id: board.folder_id } : {}),
    ...(board.project_id ? { project_id: board.project_id } : {}),
  };
}

/** Days left until a scheduled link restriction (never negative) */
export function daysUntil(date: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(date).getTime() - now) / 86_400_000));
}
