import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Globe, Link2, Loader2, Lock, Settings, Clock, UserPlus, UsersRound } from 'lucide-react';
import { AccessLevel } from '../lib/types';
import { cn, formatDateShort, getRandomCollaboratorColor } from '../lib/utils';
import {
  BoardShare,
  BoardSharing,
  fetchBoardSharing,
  keepBoardLinkOpen,
  removeBoardShare,
  shareBoard,
  updateBoardShare,
} from '../lib/sharing';
import { TeamMember, listTeamMembers, updateTeam } from '../lib/teams';
import { useTeams } from '../hooks/useTeams';
import { useProjectName } from '../hooks/useProjectName';
import { useSettings } from '../hooks/useSettings';
import { Modal, ModalIcon } from './Modal';
import { Avatar } from './Avatar';
import { TeamAvatar } from './TeamSwitcher';
import { Button } from './ui/Button';
import { useI18n } from '../i18n';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardTitle: string;
  accessLevel: AccessLevel;
  /** Board created without an account and not claimed yet: always open for editing by link */
  isAnonymous: boolean;
  /** The user can see who has access (team, project or direct invite) */
  isMember: boolean;
  /** Returns false when the database refused the change */
  onUpdateAccessLevel: (level: AccessLevel) => Promise<boolean>;
  /** Called after changes that alter what the current user can do (e.g. removing own access) */
  onAccessChanged?: () => void;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back below
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}

/** Initial in a circle, for people who are only an e-mail address here */
function EmailAvatar({ email }: { email: string }) {
  return (
    <span aria-hidden="true" className="w-8 h-8 rounded-full bg-fill-2 text-label-2 text-xs font-semibold flex items-center justify-center flex-shrink-0">
      {email.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Sharing like Google Drive: invite people by e-mail as viewers or editors, see who has access
 * (and why), and choose the general access of the link.
 */
export function ShareModal({
  isOpen,
  onClose,
  boardId,
  boardTitle,
  accessLevel,
  isAnonymous,
  isMember,
  onUpdateAccessLevel,
  onAccessChanged,
}: ShareModalProps) {
  const { t } = useI18n();
  const projectName = useProjectName();
  const { teams, refreshTeams } = useTeams();
  const { openAuthDialog } = useSettings();
  const emailListId = useId();
  const [sharing, setSharing] = useState<BoardSharing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardShare['role']>('view');
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [teammates, setTeammates] = useState<TeamMember[]>([]);

  const shareUrl = `${window.location.origin}/b/${boardId}`;
  const team = sharing?.team ? teams.find((candidate) => candidate.id === sharing.team?.id) : undefined;
  const isTeamAdmin = team?.my_role === 'owner' || team?.my_role === 'admin';
  const canShare = !!sharing?.can_share;
  const level = sharing?.access_level ?? accessLevel;

  async function load() {
    if (!isMember || isAnonymous) {
      setSharing(null);
      return;
    }
    setLoading(true);
    try {
      setSharing(await fetchBoardSharing(boardId));
      setError(null);
    } catch {
      setError(t('share.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    setEmail('');
    setError(null);
    setShowSettings(false);
    load();
  }, [isOpen, boardId, isMember, isAnonymous]);

  // Suggest teammates' addresses while typing (only people you already share a team with)
  useEffect(() => {
    if (!isOpen || !sharing?.team || !team) return;
    listTeamMembers(sharing.team.id)
      .then(setTeammates)
      .catch(() => setTeammates([]));
  }, [isOpen, sharing?.team?.id, team?.id]);

  async function run(action: () => Promise<unknown>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      const message = String((err as Error)?.message || '');
      setError(/muitos convites|limite/i.test(message) ? t('share.limitError') : failure);
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      setError(t('share.invalidEmail'));
      return;
    }
    setInviting(true);
    await run(() => shareBoard(boardId, address, role), t('share.inviteError'));
    setInviting(false);
    setEmail('');
  }

  async function handleGeneralAccess(next: AccessLevel) {
    if (next === level) return;
    setBusy(true);
    setError(null);
    const ok = await onUpdateAccessLevel(next);
    if (!ok) setError(t('share.accessError'));
    await load();
    setBusy(false);
  }

  async function handleCopy() {
    if (await copyText(shareUrl)) {
      setCopied(true);
      navigator.vibrate?.(10);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isLinkOpen = level === 'edit' || level === 'view';
  const restrictAt = sharing?.restrict_link_at;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('share.titleWithName', { title: boardTitle || t('board.untitled') })}
      icon={
        <ModalIcon>
          <UsersRound />
        </ModalIcon>
      }
    >
      <div className="space-y-6">
        {isAnonymous && (
          <div className="rounded-xl bg-fill px-3.5 py-3 text-sm text-label-2">
            <p>{t('share.anonymousNote')}</p>
            <Button variant="tinted" size="sm" className="mt-2" onClick={() => openAuthDialog('login')}>
              {t('share.signInToRestrict')}
            </Button>
          </div>
        )}

        {/* Invite people */}
        {canShare && (
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="share-email" className="sr-only">
              {t('share.addPeople')}
            </label>
            <input
              id="share-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              list={emailListId}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('share.addPeoplePlaceholder')}
              className="field h-10 flex-1 min-w-0"
            />
            <datalist id={emailListId}>
              {teammates.map((m) => (
                <option key={m.user_id} value={m.email}>
                  {m.name || m.email}
                </option>
              ))}
            </datalist>
            <div className="flex gap-2">
              <select
                aria-label={t('share.inviteRole')}
                value={role}
                onChange={(e) => setRole(e.target.value as BoardShare['role'])}
                className="field h-10 w-auto py-0 text-sm"
              >
                <option value="view">{t('share.roleView')}</option>
                <option value="edit">{t('share.roleEdit')}</option>
              </select>
              <Button type="submit" variant="primary" disabled={inviting || !email.trim()} className="flex-1 sm:flex-none">
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{t('share.invite')}</span>
              </Button>
            </div>
          </form>
        )}

        {error && (
          <p className="text-sm text-danger-text" role="alert">
            {error}
          </p>
        )}

        {/* People with access */}
        {sharing && (
          <section aria-labelledby="share-people">
            <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
              <h3 id="share-people" className="section-label">
                {t('share.peopleWithAccess')}
              </h3>
              {isTeamAdmin && (
                <button
                  type="button"
                  onClick={() => setShowSettings((v) => !v)}
                  aria-expanded={showSettings}
                  className="pressable w-7 h-7 flex items-center justify-center rounded-full text-label-2 hover:text-label hover:bg-fill"
                  aria-label={t('share.settings')}
                  title={t('share.settings')}
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {showSettings && team && (
                <motion.label
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 flex items-start gap-3 rounded-xl bg-fill px-3.5 py-3 cursor-pointer overflow-hidden"
                >
                  <input
                    type="checkbox"
                    checked={team.editors_can_share}
                    disabled={busy}
                    onChange={(e) =>
                      run(async () => {
                        await updateTeam(team.id, { editorsCanShare: e.target.checked });
                        await refreshTeams();
                      }, t('share.settingsError'))
                    }
                    className="mt-0.5 w-4 h-4 accent-[rgb(var(--accent))]"
                  />
                  <span className="text-sm">
                    <span className="block text-label">{t('share.editorsCanShare')}</span>
                    <span className="block text-xs text-label-2">{t('share.editorsCanShareHint', { team: team.name })}</span>
                  </span>
                </motion.label>
              )}
            </AnimatePresence>

            <ul className="rounded-xl bg-fill divide-y divide-separator overflow-hidden">
              {sharing.creator && (
                <li className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar id={sharing.creator.user_id} color={getRandomCollaboratorColor(sharing.creator.user_id)} className="w-8 h-8 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-label truncate">
                      {sharing.creator.name || sharing.creator.email}
                      {sharing.creator.is_you && <span className="text-label-2"> ({t('share.you')})</span>}
                    </span>
                    <span className="block text-xs text-label-2 truncate">{sharing.creator.email}</span>
                  </span>
                  <span className="text-xs text-label-2 flex-shrink-0">{t('share.creator')}</span>
                </li>
              )}

              {/* Inherited access: shown for context, managed in the team or the project */}
              {sharing.team && sharing.project?.visibility !== 'private' && (
                <li className="flex items-center gap-3 px-3 py-2.5">
                  <TeamAvatar team={sharing.team} className="w-8 h-8 rounded-full text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-label truncate">
                      {sharing.team.is_personal ? t('share.personalTeam', { team: sharing.team.name }) : t('share.teamMembers', { team: sharing.team.name })}
                    </span>
                    <span className="block text-xs text-label-2 truncate">{t('share.people', { count: sharing.team.member_count })}</span>
                  </span>
                  <span className="text-xs text-label-2 flex-shrink-0">{t('share.byTeam')}</span>
                </li>
              )}
              {sharing.project?.visibility === 'private' && (
                <li className="flex items-center gap-3 px-3 py-2.5">
                  <span aria-hidden="true" className="w-8 h-8 rounded-full bg-fill-2 text-label-2 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-label truncate">{t('share.privateProject', { project: projectName(sharing.project) })}</span>
                    <span className="block text-xs text-label-2 truncate">
                      {t('share.privateProjectPeople', { count: sharing.project.member_count ?? 0, team: sharing.team?.name ?? '' })}
                    </span>
                  </span>
                  <span className="text-xs text-label-2 flex-shrink-0">{t('share.byProject')}</span>
                </li>
              )}

              {sharing.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                  <EmailAvatar email={member.email} />
                  <span className="min-w-0 flex-1 text-sm text-label truncate">
                    {member.email}
                    {member.is_you && <span className="text-label-2"> ({t('share.you')})</span>}
                  </span>
                  {canShare ? (
                    <select
                      aria-label={t('share.roleOf', { email: member.email })}
                      value={member.role}
                      disabled={busy}
                      onChange={(e) =>
                        e.target.value === 'remove'
                          ? run(() => removeBoardShare(member.id), t('share.removeError'))
                          : run(() => updateBoardShare(member.id, e.target.value as BoardShare['role']), t('share.updateError'))
                      }
                      className="field h-8 w-auto py-0 text-xs flex-shrink-0"
                    >
                      <option value="view">{t('share.roleView')}</option>
                      <option value="edit">{t('share.roleEdit')}</option>
                      <option value="remove">{t('share.remove')}</option>
                    </select>
                  ) : member.is_you ? (
                    <Button
                      size="sm"
                      variant="danger-plain"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await removeBoardShare(member.id);
                          onAccessChanged?.();
                        }, t('share.removeError'))
                      }
                    >
                      {t('share.removeMyAccess')}
                    </Button>
                  ) : (
                    <span className="text-xs text-label-2 flex-shrink-0">{member.role === 'edit' ? t('share.roleEdit') : t('share.roleView')}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {loading && !sharing && (
          <div className="flex justify-center py-4" role="status">
            <Loader2 className="w-5 h-5 animate-spin text-label-2" />
          </div>
        )}

        {/* General access */}
        <section aria-labelledby="share-general">
          <h3 id="share-general" className="section-label px-1 mb-1.5">
            {t('share.generalAccess')}
          </h3>
          <div className="rounded-xl bg-fill px-3 py-3 flex items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                isLinkOpen ? 'bg-success/15 text-success' : 'bg-fill-2 text-label-2'
              )}
            >
              {isLinkOpen ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </span>
            <div className="min-w-0 flex-1">
              {canShare && !isAnonymous ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={t('share.generalAccess')}
                    value={isLinkOpen ? 'link' : 'restricted'}
                    disabled={busy}
                    onChange={(e) => handleGeneralAccess(e.target.value === 'link' ? 'view' : 'restricted')}
                    className="field h-8 w-auto py-0 text-sm font-medium"
                  >
                    <option value="restricted">{t('share.restricted')}</option>
                    <option value="link">{t('share.anyoneWithLink')}</option>
                  </select>
                  {isLinkOpen && (
                    <select
                      aria-label={t('share.linkRole')}
                      value={level}
                      disabled={busy}
                      onChange={(e) => handleGeneralAccess(e.target.value as AccessLevel)}
                      className="field h-8 w-auto py-0 text-sm"
                    >
                      <option value="view">{t('share.roleView')}</option>
                      <option value="edit">{t('share.roleEdit')}</option>
                    </select>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-label">
                  {isLinkOpen ? t('share.anyoneWithLink') : t('share.restricted')}
                  {isLinkOpen && <span className="font-normal text-label-2"> · {level === 'edit' ? t('share.roleEdit') : t('share.roleView')}</span>}
                </p>
              )}
              <p className="mt-1 text-xs text-label-2">
                {!isLinkOpen
                  ? t('share.restrictedHint')
                  : level === 'edit'
                    ? t('share.linkEditHint')
                    : t('share.linkViewHint')}
              </p>
              {!canShare && !isAnonymous && isMember && <p className="mt-1 text-xs text-label-2">{t('share.cannotShare')}</p>}
            </div>
          </div>

          {/* Migration with notice: this link is going to be restricted */}
          {restrictAt && isLinkOpen && (
            <div className="mt-2 rounded-xl bg-warning/10 px-3.5 py-3" role="status">
              <p className="flex items-start gap-2 text-sm text-label">
                <Clock className="w-4 h-4 mt-0.5 text-warning flex-shrink-0" />
                <span>{t('share.linkWillRestrict', { date: formatDateShort(restrictAt) })}</span>
              </p>
              {canShare && (
                <div className="mt-2 flex flex-wrap gap-2 pl-6">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => keepBoardLinkOpen(boardId), t('share.accessError'))}>
                    {t('share.keepLinkOpen')}
                  </Button>
                  <Button size="sm" variant="plain" disabled={busy} onClick={() => handleGeneralAccess('restricted')}>
                    {t('share.restrictNow')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <Button
            variant={copied ? 'tinted' : 'secondary'}
            onClick={handleCopy}
            className={cn(copied && 'bg-success/15 text-success hover:bg-success/15')}
          >
            {copied ? <Check className="w-4 h-4" strokeWidth={2.75} /> : <Link2 className="w-4 h-4" />}
            <span aria-live="polite">{copied ? t('share.copied') : t('share.copyLink')}</span>
          </Button>
          <Button variant="primary" onClick={onClose}>
            {t('share.done')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
