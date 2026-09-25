import { useEffect, useState } from 'react';
import { FolderKanban, Loader2, Lock, Trash2, UsersRound, X } from 'lucide-react';
import { Modal, ModalIcon } from './Modal';
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/SegmentedControl';
import {
  Project,
  ProjectMember,
  ProjectVisibility,
  Team,
  TeamMember,
  canManageProject,
  canManageTeam,
  createProject,
  deleteProject,
  listProjectMembers,
  listTeamMembers,
  setProjectMember,
  updateProject,
} from '../lib/teams';
import { useProjectName } from '../hooks/useProjectName';
import { useI18n } from '../i18n';

interface ProjectModalProps {
  isOpen: boolean;
  team: Team;
  /** null = create a new project */
  project: Project | null;
  userId: string | undefined;
  onClose: () => void;
  onSaved: (project: Project) => void;
  onDeleted: (projectId: string) => void;
}

/** Create a project, or rename it, open or close it to the team and choose who is in it */
export function ProjectModal({ isOpen, team, project, userId, onClose, onSaved, onDeleted }: ProjectModalProps) {
  const { t } = useI18n();
  const projectName = useProjectName();
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<ProjectVisibility>('team');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMember, setNewMember] = useState('');
  const [newRole, setNewRole] = useState<ProjectMember['role']>('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = !!project;
  const canManage = !project || canManageProject(project, team, userId);
  const showMembers = isEdit && project.visibility === 'private' && canManage;

  useEffect(() => {
    if (!isOpen) return;
    setName(project ? projectName(project) : '');
    setVisibility(project?.visibility ?? 'team');
    setError(null);
    setConfirmDelete(false);
    setNewMember('');
  }, [isOpen, project?.id]);

  useEffect(() => {
    if (!isOpen || !showMembers || !project) return;
    let cancelled = false;
    Promise.all([listProjectMembers(project.id), listTeamMembers(team.id)])
      .then(([projectMembers, all]) => {
        if (cancelled) return;
        setMembers(projectMembers);
        setTeamMembers(all);
      })
      .catch(() => !cancelled && setError(t('projects.loadMembersError')));
    return () => {
      cancelled = true;
    };
  }, [isOpen, showMembers, project?.id, team.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = project
        ? await updateProject(project.id, {
            name: name.trim() === projectName(project) ? undefined : name,
            visibility: visibility === project.visibility ? undefined : visibility,
          })
        : await createProject(team.id, name, visibility);
      onSaved(saved);
      // Closing a project to the team keeps the modal open to pick who is in it
      if (!(project && visibility === 'private' && project.visibility === 'team')) onClose();
    } catch {
      setError(t('projects.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function changeMember(userIdToChange: string, role: ProjectMember['role'] | null) {
    if (!project) return;
    setError(null);
    try {
      await setProjectMember(project.id, userIdToChange, role);
      setMembers(await listProjectMembers(project.id));
    } catch {
      setError(t('projects.memberError'));
    }
  }

  async function handleDelete() {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProject(project.id);
      onDeleted(project.id);
      onClose();
    } catch (err) {
      setError(/quadros/.test((err as Error).message) ? t('projects.deleteNotEmpty') : t('projects.deleteError'));
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  const candidates = teamMembers.filter((m) => !members.some((pm) => pm.user_id === m.user_id));
  const canDelete = isEdit && !project.is_default && canManageTeam(team);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEdit ? t('projects.settingsTitle') : t('projects.new')}
      description={isEdit ? undefined : t('projects.newDescription', { team: team.name })}
      icon={
        <ModalIcon>
          <FolderKanban />
        </ModalIcon>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="project-name" className="block text-callout font-medium text-label mb-1.5">
            {t('projects.name')}
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            disabled={!canManage}
            className="field h-11"
          />
        </div>

        <div>
          <p id="project-visibility" className="block text-callout font-medium text-label mb-1.5">
            {t('projects.visibility')}
          </p>
          <SegmentedControl<ProjectVisibility>
            aria-label={t('projects.visibility')}
            value={visibility}
            onChange={(value) => canManage && !project?.is_default && setVisibility(value)}
            className="w-full"
            options={[
              { value: 'team', label: t('projects.visibilityTeam'), icon: UsersRound },
              { value: 'private', label: t('projects.visibilityPrivate'), icon: Lock },
            ]}
          />
          <p className="mt-1.5 text-xs text-label-2">
            {project?.is_default
              ? t('projects.defaultAlwaysOpen')
              : visibility === 'team'
                ? t('projects.visibilityTeamHint', { team: team.name })
                : t('projects.visibilityPrivateHint')}
          </p>
        </div>

        {showMembers && (
          <section aria-labelledby="project-members">
            <h3 id="project-members" className="section-label px-1 mb-1.5">
              {t('projects.members')}
            </h3>
            <ul className="rounded-xl bg-fill divide-y divide-separator overflow-hidden">
              {members.map((member) => (
                <li key={member.user_id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-label truncate">{member.name || member.email}</span>
                    <span className="block text-xs text-label-2 truncate">{member.email}</span>
                  </span>
                  <select
                    aria-label={t('projects.roleOf', { name: member.name || member.email })}
                    value={member.role}
                    onChange={(e) => changeMember(member.user_id, e.target.value as ProjectMember['role'])}
                    className="field h-8 w-auto py-0 text-xs"
                  >
                    <option value="edit">{t('share.roleEdit')}</option>
                    <option value="view">{t('share.roleView')}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => changeMember(member.user_id, null)}
                    className="pressable w-7 h-7 flex items-center justify-center rounded-full text-label-2 hover:text-label hover:bg-fill-2"
                    aria-label={t('projects.removeMember', { name: member.name || member.email })}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {members.length === 0 && <li className="px-3 py-2.5 text-sm text-label-2">{t('projects.noMembers')}</li>}
            </ul>
            {candidates.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  aria-label={t('projects.addMember')}
                  value={newMember}
                  onChange={(e) => setNewMember(e.target.value)}
                  className="field h-9 flex-1 min-w-0 py-0 text-sm"
                >
                  <option value="">{t('projects.addMember')}</option>
                  {candidates.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name ? `${m.name} (${m.email})` : m.email}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t('projects.newMemberRole')}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as ProjectMember['role'])}
                  className="field h-9 w-auto py-0 text-sm"
                >
                  <option value="edit">{t('share.roleEdit')}</option>
                  <option value="view">{t('share.roleView')}</option>
                </select>
                <Button
                  size="sm"
                  variant="tinted"
                  disabled={!newMember}
                  onClick={async () => {
                    await changeMember(newMember, newRole);
                    setNewMember('');
                  }}
                >
                  {t('projects.add')}
                </Button>
              </div>
            )}
            <p className="px-1 mt-1.5 text-xs text-label-2">{t('projects.adminsAlwaysSee')}</p>
          </section>
        )}

        {error && (
          <p className="text-sm text-danger-text" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
          {canDelete &&
            (confirmDelete ? (
              <Button variant="danger" onClick={handleDelete} disabled={saving}>
                <Trash2 className="w-4 h-4" />
                <span>{t('projects.confirmDelete')}</span>
              </Button>
            ) : (
              <Button variant="danger-plain" onClick={() => setConfirmDelete(true)} disabled={saving}>
                <Trash2 className="w-4 h-4" />
                <span>{t('projects.delete')}</span>
              </Button>
            ))}
          <div className="sm:ml-auto flex flex-col-reverse sm:flex-row gap-2">
            <Button onClick={onClose} disabled={saving}>
              {canManage ? t('common.cancel') : t('common.close')}
            </Button>
            {canManage && (
              <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isEdit ? t('common.save') : t('projects.create')}</span>
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
