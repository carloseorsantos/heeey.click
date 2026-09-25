import { supabase } from './supabase';

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ProjectVisibility = 'team' | 'private';
export type ProjectAccess = 'manage' | 'edit' | 'view';

export interface Team {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  editors_can_share: boolean;
  created_at: string;
  my_role: TeamRole;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  visibility: ProjectVisibility;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  my_access: ProjectAccess | null;
}

export interface TeamMember {
  user_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: TeamRole;
  created_at: string;
}

export interface ProjectMember {
  user_id: string;
  email: string;
  name: string | null;
  role: 'edit' | 'view';
}

export interface TeamInvite {
  id: string;
  role: Exclude<TeamRole, 'owner'>;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface InvitePreview {
  status: 'valid' | 'expired' | 'used' | 'revoked' | 'invalid';
  team_name?: string;
  team_slug?: string | null;
  role?: TeamRole;
  invited_by?: string | null;
  is_member?: boolean;
}

/** Name the default project was created with; shown translated while nobody renames it */
export const DEFAULT_PROJECT_NAME = 'Geral';

export const canManageTeam = (team: Team | null | undefined) => team?.my_role === 'owner' || team?.my_role === 'admin';
export const canEditProject = (project: Project | null | undefined) =>
  project?.my_access === 'manage' || project?.my_access === 'edit';

/** Error raised by the database, kept for the UI to show (messages come in Portuguese) */
export class TeamError extends Error {}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new TeamError(result.error.message);
  return result.data as T;
}

/** Makes sure the personal team exists and activates pending board invites (called on sign-in) */
export async function ensurePersonalTeam(): Promise<void> {
  const { error } = await supabase.rpc('ensure_personal_team');
  if (error) console.warn('Erro ao preparar o time pessoal:', error.message);
}

export async function fetchMyTeams(): Promise<Team[] | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('id,name,slug,is_personal,editors_can_share,created_at,my_role')
    .order('is_personal', { ascending: false })
    .order('name', { ascending: true });
  if (error) {
    console.warn('Erro ao carregar times:', error.message);
    return null;
  }
  return (data || []) as Team[];
}

export async function fetchProjects(teamId: string): Promise<Project[] | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id,team_id,name,visibility,is_default,created_by,created_at,my_access')
    .eq('team_id', teamId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });
  if (error) {
    console.warn('Erro ao carregar projetos:', error.message);
    return null;
  }
  return (data || []) as Project[];
}

export const createTeam = async (name: string) =>
  unwrap<Team>(await supabase.rpc('create_team', { p_name: name.trim() }));

export const updateTeam = async (teamId: string, changes: { name?: string; editorsCanShare?: boolean }) =>
  unwrap<Team>(
    await supabase.rpc('update_team', {
      p_team_id: teamId,
      p_name: changes.name?.trim() ?? null,
      p_editors_can_share: changes.editorsCanShare ?? null,
    })
  );

export const deleteTeam = async (teamId: string) => unwrap<boolean>(await supabase.rpc('delete_team', { p_team_id: teamId }));

export const listTeamMembers = async (teamId: string) =>
  unwrap<TeamMember[]>(await supabase.rpc('list_team_members', { p_team_id: teamId }));

export const setTeamMemberRole = async (teamId: string, userId: string, role: TeamRole) =>
  unwrap<boolean>(await supabase.rpc('set_team_member_role', { p_team_id: teamId, p_user_id: userId, p_role: role }));

/** Also used to leave a team (userId = yourself) */
export const removeTeamMember = async (teamId: string, userId: string) =>
  unwrap<boolean>(await supabase.rpc('remove_team_member', { p_team_id: teamId, p_user_id: userId }));

export async function listTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('id,role,created_at,expires_at,accepted_at,revoked_at')
    .eq('team_id', teamId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw new TeamError(error.message);
  return (data || []) as TeamInvite[];
}

/** The token is only available here; the link is /invite/<token> */
export async function createTeamInvite(teamId: string, role: TeamInvite['role']): Promise<{ url: string; expiresAt: string }> {
  const rows = unwrap<{ id: string; token: string; expires_at: string }[]>(
    await supabase.rpc('create_team_invite', { p_team_id: teamId, p_role: role })
  );
  const row = Array.isArray(rows) ? rows[0] : (rows as any);
  return { url: `${window.location.origin}/invite/${row.token}`, expiresAt: row.expires_at };
}

export const revokeTeamInvite = async (inviteId: string) =>
  unwrap<boolean>(await supabase.rpc('revoke_team_invite', { p_invite_id: inviteId }));

export async function getTeamInvite(token: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc('get_team_invite', { p_token: token });
  if (error || !data) return { status: 'invalid' };
  return data as InvitePreview;
}

export const acceptTeamInvite = async (token: string) =>
  unwrap<Team>(await supabase.rpc('accept_team_invite', { p_token: token }));

export const createProject = async (teamId: string, name: string, visibility: ProjectVisibility) =>
  unwrap<Project>(await supabase.rpc('create_project', { p_team_id: teamId, p_name: name.trim(), p_visibility: visibility }));

export const updateProject = async (projectId: string, changes: { name?: string; visibility?: ProjectVisibility }) =>
  unwrap<Project>(
    await supabase.rpc('update_project', {
      p_project_id: projectId,
      p_name: changes.name?.trim() ?? null,
      p_visibility: changes.visibility ?? null,
    })
  );

export const deleteProject = async (projectId: string) =>
  unwrap<boolean>(await supabase.rpc('delete_project', { p_project_id: projectId }));

export const listProjectMembers = async (projectId: string) =>
  unwrap<ProjectMember[]>(await supabase.rpc('list_project_members', { p_project_id: projectId }));

/** role null removes the person from the project */
export const setProjectMember = async (projectId: string, userId: string, role: ProjectMember['role'] | null) =>
  unwrap<boolean>(await supabase.rpc('set_project_member', { p_project_id: projectId, p_user_id: userId, p_role: role }));

export const canManageProject = (project: Project, team: Team | null | undefined, userId: string | undefined) =>
  canManageTeam(team) || (project.my_access === 'edit' && !!userId && project.created_by === userId);
