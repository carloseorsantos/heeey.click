import { useEffect, useState } from 'react';
import { FolderPlus, Edit3, Loader2 } from 'lucide-react';
import { Modal, ModalIcon } from './Modal';
import { Button } from './ui/Button';
import { useI18n } from '../i18n';

interface FolderNameModalProps {
  isOpen: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<boolean>;
}

export function FolderNameModal({ isOpen, mode, initialName = '', onClose, onSubmit }: FolderNameModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setError(false);
    }
  }, [isOpen, initialName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(false);
    const ok = await onSubmit(trimmed);
    setSaving(false);
    if (ok) onClose();
    else setError(true);
  }

  const Icon = mode === 'create' ? FolderPlus : Edit3;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={mode === 'create' ? t('folders.new') : t('folders.renameTitle')}
      size="sm"
      icon={
        <ModalIcon>
          <Icon />
        </ModalIcon>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="folder-name" className="block text-callout font-medium text-label mb-1.5">
            {t('folders.name')}
          </label>
          <input
            id="folder-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            className="field h-11"
          />
          {error && (
            <p className="mt-2 text-sm text-danger-text" role="alert">
              {t('folders.saveError')}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'create' ? t('folders.create') : t('common.save')}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
