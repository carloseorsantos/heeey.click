import { useEffect, useState } from 'react';
import { Globe, Loader2, Lock, Inbox } from 'lucide-react';
import { Modal, ModalIcon } from './Modal';
import { Button } from './ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useTeams } from '../hooks/useTeams';
import { useProjectName } from '../hooks/useProjectName';
import { getClaimableLocalBoards, markLocalBoardClaimed } from '../lib/storage';
import { claimBoard, toBoardInsert } from '../lib/sharing';
import { Project, canEditProject, fetchProjects } from '../lib/teams';
import { supabase } from '../lib/supabase';
import { Board } from '../lib/types';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';

const DISMISSED_KEY = 'heeey_claim_dismissed';
/** Fired after boards change team, so open boards and the dashboard reload them */
export const BOARDS_CLAIMED_EVENT = 'heeey:boards-claimed';
/** Fired by the dashboard banner to ask again */
export const OPEN_CLAIM_EVENT = 'heeey:open-claim';

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * After signing in: boards this browser created without an account go to a team and project
 * the person picks, and they decide whether the link stays open or becomes restricted
 * (nothing is preselected for that choice).
 */
export function ClaimBoardsDialog() {
  const { user, guestProfile } = useAuth();
  const { teams, available } = useTeams();
  const { t } = useI18n();
  const projectName = useProjectName();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [access, setAccess] = useState<'edit' | 'restricted' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Offer once per session, as soon as the account and its teams are ready
  useEffect(() => {
    if (!user?.id || !available) return;
    const claimable = getClaimableLocalBoards(guestProfile.id);
    setBoards(claimable);
    if (claimable.length > 0 && !wasDismissed()) setIsOpen(true);
  }, [user?.id, available, guestProfile.id]);

  useEffect(() => {
    const reopen = () => {
      const claimable = getClaimableLocalBoards(guestProfile.id);
      setBoards(claimable);
      if (claimable.length > 0) setIsOpen(true);
    };
    window.addEventListener(OPEN_CLAIM_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CLAIM_EVENT, reopen);
  }, [guestProfile.id]);

  useEffect(() => {
    if (isOpen && !teamId && teams.length > 0) setTeamId((teams.find((team) => team.is_personal) ?? teams[0]).id);
  }, [isOpen, teams, teamId]);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    fetchProjects(teamId).then((result) => {
      if (cancelled) return;
      const editable = (result || []).filter(canEditProject);
      setProjects(editable);
      setProjectId((editable.find((p) => p.is_default) ?? editable[0])?.id ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Asked again next time
    }
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !projectId || !access) return;
    setSaving(true);
    setError(null);
    const claimed: string[] = [];
    let failed = 0;
    for (const board of boards) {
      try {
        let result = await claimBoard(board.id, projectId, access);
        if (result === 'not-found') {
          // Only in this browser so far: save it straight into the project
          const { error: insertError } = await supabase
            .from('boards')
            .insert(toBoardInsert({ ...board, owner_id: user.id, project_id: projectId, folder_id: null, access_level: access }));
          if (insertError) throw insertError;
          result = 'claimed';
        }
        markLocalBoardClaimed(board, { owner_id: user.id, team_id: teamId, project_id: projectId, access_level: access });
        claimed.push(board.id);
      } catch (err) {
        console.warn(`Erro ao guardar o quadro ${board.id}:`, err);
        failed++;
      }
    }
    setSaving(false);
    if (claimed.length) window.dispatchEvent(new CustomEvent(BOARDS_CLAIMED_EVENT, { detail: claimed }));
    if (failed) {
      setBoards((prev) => prev.filter((b) => !claimed.includes(b.id)));
      setError(t('claim.partialError', { count: failed }));
    } else {
      setIsOpen(false);
    }
  }

  const shown = boards.slice(0, 4);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && dismiss()}
      title={t('claim.title', { count: boards.length })}
      description={t('claim.description')}
      icon={
        <ModalIcon>
          <Inbox />
        </ModalIcon>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <ul className="rounded-xl bg-fill px-3.5 py-2.5 text-sm text-label space-y-1">
          {shown.map((board) => (
            <li key={board.id} className="truncate">
              {board.title || t('board.untitled')}
            </li>
          ))}
          {boards.length > shown.length && <li className="text-label-2">{t('claim.andMore', { count: boards.length - shown.length })}</li>}
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-callout font-medium text-label mb-1.5">{t('claim.team')}</span>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="field h-10 py-0">
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.is_personal ? `${team.name} (${t('teams.personal')})` : team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-callout font-medium text-label mb-1.5">{t('claim.project')}</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field h-10 py-0" disabled={projects.length === 0}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {projectName(project)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="block text-callout font-medium text-label mb-1.5">{t('claim.access')}</legend>
          <div className="rounded-xl bg-fill overflow-hidden divide-y divide-separator">
            {(
              [
                { value: 'edit', Icon: Globe, label: t('claim.keepOpen'), hint: t('claim.keepOpenHint') },
                { value: 'restricted', Icon: Lock, label: t('claim.restrict'), hint: t('claim.restrictHint') },
              ] as const
            ).map(({ value, Icon, label, hint }) => (
              <label key={value} className={cn('flex items-start gap-3 px-3.5 py-3 cursor-pointer', access === value && 'bg-fill-2')}>
                <input
                  type="radio"
                  name="claim-access"
                  value={value}
                  checked={access === value}
                  onChange={() => setAccess(value)}
                  className="mt-1 w-4 h-4 accent-[rgb(var(--accent))]"
                />
                <Icon className="w-4 h-4 mt-0.5 text-label-2 flex-shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm text-label">{label}</span>
                  <span className="block text-xs text-label-2">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="text-sm text-danger-text" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button onClick={dismiss} disabled={saving}>
            {t('claim.notNow')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !projectId || !access}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{t('claim.save')}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
