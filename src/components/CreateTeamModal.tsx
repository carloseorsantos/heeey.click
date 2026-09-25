import { useEffect, useState } from 'react';
import { Loader2, UsersRound } from 'lucide-react';
import { Modal, ModalIcon } from './Modal';
import { Button } from './ui/Button';
import { Team, createTeam } from '../lib/teams';
import { useI18n } from '../i18n';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (team: Team) => void;
}

export function CreateTeamModal({ isOpen, onClose, onCreated }: CreateTeamModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const team = await createTeam(name);
      onCreated(team);
      onClose();
    } catch (err) {
      setError(/limite/i.test(String((err as Error).message)) ? t('teams.limitReached') : t('teams.createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={t('teams.create')}
      description={t('teams.createDescription')}
      size="sm"
      icon={
        <ModalIcon>
          <UsersRound />
        </ModalIcon>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="team-name" className="block text-callout font-medium text-label mb-1.5">
            {t('teams.name')}
          </label>
          <input
            id="team-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            placeholder={t('teams.namePlaceholder')}
            className="field h-11"
          />
          {error && (
            <p className="mt-2 text-sm text-danger-text" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{t('teams.createAction')}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
