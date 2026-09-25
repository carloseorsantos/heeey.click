import { useEffect, useState } from 'react';
import { Check, FolderKanban, Loader2, Lock } from 'lucide-react';
import { Modal, ModalIcon } from './Modal';
import { TeamAvatar } from './TeamSwitcher';
import { Project, Team, canEditProject, canManageTeam, fetchProjects } from '../lib/teams';
import { useProjectName } from '../hooks/useProjectName';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';

interface MoveToProjectModalProps {
  isOpen: boolean;
  itemName: string;
  teams: Team[];
  /** Team and project the board is in now */
  team: Team;
  currentProjectId: string | null;
  onClose: () => void;
  onMove: (project: Project) => Promise<string | null>;
}

/**
 * Other projects of the team the user can edit; owners/admins also see the projects of their
 * other teams where they are owner/admin (moving between teams needs both).
 */
export function MoveToProjectModal({ isOpen, itemName, teams, team, currentProjectId, onClose, onMove }: MoveToProjectModalProps) {
  const { t } = useI18n();
  const projectName = useProjectName();
  const [groups, setGroups] = useState<{ team: Team; projects: Project[] }[]>([]);
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError(null);
    const targets = [team, ...(canManageTeam(team) ? teams.filter((other) => other.id !== team.id && canManageTeam(other)) : [])];
    Promise.all(targets.map(async (target) => ({ team: target, projects: (await fetchProjects(target.id)) || [] }))).then((result) => {
      if (cancelled) return;
      setGroups(
        result
          .map((group) => ({ ...group, projects: group.projects.filter(canEditProject) }))
          .filter((group) => group.projects.length > 0)
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, team.id]);

  async function handleMove(project: Project) {
    setMovingTo(project.id);
    setError(null);
    const failure = await onMove(project);
    setMovingTo(null);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !movingTo && onClose()}
      title={t('projects.moveTitle')}
      description={t('projects.moveDescription', { name: itemName })}
      size="sm"
      icon={
        <ModalIcon>
          <FolderKanban />
        </ModalIcon>
      }
    >
      {error && (
        <p className="mb-3 text-sm text-danger-text" role="alert">
          {error}
        </p>
      )}
      <div className="max-h-[55vh] overflow-y-auto space-y-4">
        {groups.map((group) => (
          <section key={group.team.id} aria-label={group.team.name}>
            {groups.length > 1 && (
              <h3 className="flex items-center gap-2 px-1 mb-1.5 section-label">
                <TeamAvatar team={group.team} className="w-4 h-4 text-[9px] rounded" />
                {group.team.name}
              </h3>
            )}
            <ul className="rounded-xl bg-fill p-1 space-y-0.5">
              {group.projects.map((project) => {
                const isCurrent = project.id === currentProjectId;
                return (
                  <li key={project.id}>
                    <button
                      onClick={() => handleMove(project)}
                      disabled={isCurrent || !!movingTo}
                      className={cn(
                        'w-full h-10 flex items-center gap-2.5 px-2.5 rounded-lg text-sm text-left transition-colors',
                        isCurrent ? 'text-label-2 cursor-default' : 'text-label hover:bg-fill-2 disabled:opacity-50'
                      )}
                    >
                      {project.visibility === 'private' ? (
                        <Lock className="w-4 h-4 flex-shrink-0 text-accent-text" aria-label={t('projects.private')} />
                      ) : (
                        <FolderKanban className="w-4 h-4 flex-shrink-0 text-accent-text" />
                      )}
                      <span className="truncate flex-1">{projectName(project)}</span>
                      {isCurrent && <Check className="w-4 h-4 flex-shrink-0 text-accent-text" strokeWidth={2.75} aria-label={t('projects.current')} />}
                      {movingTo === project.id && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-label-2" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="text-sm text-label-2 px-1">{t('projects.noDestination')}</p>}
      </div>
      {groups.length > 1 && <p className="mt-3 px-1 text-xs text-label-2">{t('projects.moveBetweenTeamsHint')}</p>}
    </Modal>
  );
}
