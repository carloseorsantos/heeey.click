import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, LogOut, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { TeamAvatar } from '../TeamSwitcher';
import { SettingsGroup, SettingsRow } from './SettingsGroup';
import { useAuth } from '../../hooks/useAuth';
import { useTeams } from '../../hooks/useTeams';
import {
  TeamInvite,
  TeamMember,
  TeamRole,
  canManageTeam,
  createTeamInvite,
  deleteTeam,
  listTeamInvites,
  listTeamMembers,
  removeTeamMember,
  revokeTeamInvite,
  setTeamMemberRole,
  updateTeam,
} from '../../lib/teams';
import { formatDateShort } from '../../lib/utils';
import { useI18n } from '../../i18n';

const ROLES: TeamRole[] = ['owner', 'admin', 'member', 'viewer'];
const INVITE_ROLES: TeamInvite['role'][] = ['member', 'viewer', 'admin'];

/** Settings › Team: the active team's name, members, roles and invite links */
export function TeamPanel() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { activeTeam: team, refreshTeams, teams, setActiveTeamId } = useTeams();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [name, setName] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamInvite['role']>('member');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAdmin = canManageTeam(team);
  const isOwner = team?.my_role === 'owner';

  async function load() {
    if (!team) return;
    try {
      setMembers(await listTeamMembers(team.id));
      setInvites(isAdmin ? await listTeamInvites(team.id) : []);
    } catch {
      setError(t('teamSettings.loadError'));
    }
  }

  useEffect(() => {
    setName(team?.name ?? '');
    setInviteUrl(null);
    setConfirmDelete(false);
    setError(null);
    load();
  }, [team?.id, team?.my_role]);

  async function run(action: () => Promise<unknown>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      const message = String((err as Error)?.message || '');
      setError(
        /pelo menos um owner/.test(message)
          ? t('teamSettings.needsOwner')
          : /quadros/.test(message)
            ? t('teamSettings.deleteNotEmpty')
            : failure
      );
    } finally {
      setBusy(false);
    }
  }

  if (!team) return <p className="text-sm text-label-2">{t('teamSettings.none')}</p>;

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link stays selectable on screen
    }
  }

  const roleLabel = (role: TeamRole) => t(`teams.roles.${role}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TeamAvatar team={team} className="w-10 h-10 rounded-xl text-base" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-label truncate">{team.name}</p>
          <p className="text-xs text-label-2">
            {team.is_personal ? t('teams.personal') : t('teamSettings.yourRole', { role: roleLabel(team.my_role) })}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger-text" role="alert">
          {error}
        </p>
      )}

      {isAdmin && (
        <SettingsGroup footer={t('teamSettings.editorsCanShareHint')}>
          <form
            className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name.trim() !== team.name) run(() => updateTeam(team.id, { name }).then(refreshTeams), t('teamSettings.saveError'));
            }}
          >
            <label htmlFor="team-settings-name" className="text-sm text-label sm:w-32 flex-shrink-0">
              {t('teams.name')}
            </label>
            <input id="team-settings-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="field h-9 flex-1" />
            <Button type="submit" size="sm" variant="tinted" disabled={busy || !name.trim() || name.trim() === team.name}>
              {t('common.save')}
            </Button>
          </form>
          <SettingsRow label={t('share.editorsCanShare')}>
            <input
              type="checkbox"
              aria-label={t('share.editorsCanShare')}
              checked={team.editors_can_share}
              disabled={busy}
              onChange={(e) => run(() => updateTeam(team.id, { editorsCanShare: e.target.checked }).then(refreshTeams), t('teamSettings.saveError'))}
              className="w-5 h-5 accent-[rgb(var(--accent))]"
            />
          </SettingsRow>
        </SettingsGroup>
      )}

      <SettingsGroup title={t('teamSettings.members', { count: members.length })}>
        {members.map((member) => {
          const isYou = member.user_id === user?.id;
          const isPersonalOwner = team.is_personal && member.role === 'owner';
          const canChange = isAdmin && !isPersonalOwner && (isOwner || member.role !== 'owner');
          return (
            <div key={member.user_id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-label truncate">
                  {member.name || member.email}
                  {isYou && <span className="text-label-2"> ({t('share.you')})</span>}
                </p>
                <p className="text-xs text-label-2 truncate">{member.email}</p>
              </div>
              {canChange ? (
                <select
                  aria-label={t('teamSettings.roleOf', { name: member.name || member.email })}
                  value={member.role}
                  disabled={busy}
                  onChange={(e) => run(() => setTeamMemberRole(team.id, member.user_id, e.target.value as TeamRole), t('teamSettings.saveError'))}
                  className="field h-8 w-auto py-0 text-xs"
                >
                  {ROLES.filter((role) => isOwner || role !== 'owner').map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-label-2">{roleLabel(member.role)}</span>
              )}
              {canChange && !isYou && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => removeTeamMember(team.id, member.user_id), t('teamSettings.saveError'))}
                  className="pressable w-7 h-7 flex items-center justify-center rounded-full text-label-2 hover:text-danger-text hover:bg-danger/10"
                  aria-label={t('teamSettings.remove', { name: member.name || member.email })}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </SettingsGroup>

      {isAdmin && (
        <SettingsGroup title={t('teamSettings.invites')} footer={t('teamSettings.inviteHint')}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
            <select
              aria-label={t('teamSettings.inviteRole')}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamInvite['role'])}
              className="field h-9 w-auto py-0 text-sm"
            >
              {INVITE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="tinted"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const invite = await createTeamInvite(team.id, inviteRole);
                  setInviteUrl(invite.url);
                }, t('teamSettings.inviteError'))
              }
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{t('teamSettings.createInvite')}</span>
            </Button>
          </div>
          {inviteUrl && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-label-2">{t('teamSettings.inviteCopyNow')}</p>
              <div className="flex items-center gap-2">
                <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} className="field h-9 flex-1 min-w-0 font-mono text-xs text-label-2" aria-label={t('teamSettings.inviteLink')} />
                <Button size="sm" variant={copied ? 'tinted' : 'secondary'} onClick={copyInvite}>
                  {copied ? <Check className="w-3.5 h-3.5" strokeWidth={2.75} /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t('common.copied') : t('common.copy')}</span>
                </Button>
              </div>
            </div>
          )}
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 px-4 py-2.5">
              <p className="flex-1 min-w-0 text-sm text-label truncate">
                {t('teamSettings.inviteRow', { role: roleLabel(invite.role), date: formatDateShort(invite.expires_at) })}
              </p>
              <Button size="sm" variant="danger-plain" disabled={busy} onClick={() => run(() => revokeTeamInvite(invite.id), t('teamSettings.saveError'))}>
                {t('teamSettings.revoke')}
              </Button>
            </div>
          ))}
        </SettingsGroup>
      )}

      {!team.is_personal && (
        <SettingsGroup title={t('teamSettings.dangerZone')}>
          <SettingsRow label={t('teamSettings.leave')} description={t('teamSettings.leaveHint')}>
            <Button
              size="sm"
              variant="danger-plain"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await removeTeamMember(team.id, user!.id);
                  const remaining = await refreshTeams();
                  const next = remaining.find((candidate) => candidate.is_personal) ?? remaining[0];
                  if (next) setActiveTeamId(next.id);
                }, t('teamSettings.saveError'))
              }
            >
              <LogOut className="w-4 h-4" />
              <span>{t('teamSettings.leave')}</span>
            </Button>
          </SettingsRow>
          {isOwner && (
            <SettingsRow label={t('teamSettings.delete')} description={t('teamSettings.deleteHint')}>
              <Button
                size="sm"
                variant={confirmDelete ? 'danger' : 'danger-plain'}
                disabled={busy}
                onClick={() =>
                  confirmDelete
                    ? run(async () => {
                        await deleteTeam(team.id);
                        const remaining = await refreshTeams();
                        const next = remaining.find((candidate) => candidate.is_personal) ?? teams[0];
                        if (next) setActiveTeamId(next.id);
                      }, t('teamSettings.deleteError'))
                    : setConfirmDelete(true)
                }
              >
                <Trash2 className="w-4 h-4" />
                <span>{confirmDelete ? t('teamSettings.confirmDelete') : t('teamSettings.delete')}</span>
              </Button>
            </SettingsRow>
          )}
        </SettingsGroup>
      )}
    </div>
  );
}
