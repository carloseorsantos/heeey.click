import { useEffect, useState } from 'react';
import { FolderPlus, Edit3, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
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
        <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="folder-name" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
            {t('folders.name')}
          </label>
          <input
            id="folder-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {error && (
            <p className="mt-2 text-sm text-rose-700 dark:text-rose-400" role="alert">
              {t('folders.saveError')}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 transition disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'create' ? t('folders.create') : t('common.save')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
