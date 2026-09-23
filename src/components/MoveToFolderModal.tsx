import { useState } from 'react';
import { FolderInput, Folder as FolderIcon, Home, Check, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Folder, flattenFolderTree } from '../lib/folders';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';

interface MoveToFolderModalProps {
  isOpen: boolean;
  itemName: string;
  folders: Folder[];
  currentFolderId: string | null;
  onClose: () => void;
  onMove: (folderId: string | null) => Promise<boolean>;
}

export function MoveToFolderModal({
  isOpen,
  itemName,
  folders,
  currentFolderId,
  onClose,
  onMove,
}: MoveToFolderModalProps) {
  const { t } = useI18n();
  const [movingTo, setMovingTo] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const tree = flattenFolderTree(folders);

  async function handleMove(folderId: string | null) {
    setMovingTo(folderId);
    setError(false);
    const ok = await onMove(folderId);
    setMovingTo(undefined);
    if (ok) onClose();
    else setError(true);
  }

  const options: { id: string | null; name: string; depth: number }[] = [
    { id: null, name: t('folders.root'), depth: 0 },
    ...tree.map(({ folder, depth }) => ({ id: folder.id, name: folder.name, depth: depth + 1 })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => movingTo === undefined && onClose()}
      title={t('folders.moveTitle')}
      description={t('folders.moveDescription', { name: itemName })}
      size="sm"
      icon={
        <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 flex-shrink-0">
          <FolderInput className="w-5 h-5" />
        </div>
      }
    >
      {error && (
        <p className="mb-3 text-sm text-rose-700 dark:text-rose-400" role="alert">
          {t('folders.moveError')}
        </p>
      )}
      <ul className="max-h-[50vh] overflow-y-auto -mx-2 space-y-0.5">
        {options.map((option) => {
          const isCurrent = option.id === currentFolderId;
          const Icon = option.id === null ? Home : FolderIcon;
          return (
            <li key={option.id ?? 'root'}>
              <button
                onClick={() => handleMove(option.id)}
                disabled={isCurrent || movingTo !== undefined}
                style={{ paddingLeft: `${0.75 + option.depth * 1}rem` }}
                className={cn(
                  'w-full flex items-center gap-2 pr-3 py-2.5 rounded-xl text-sm text-left transition',
                  isCurrent
                    ? 'text-slate-500 dark:text-slate-400 cursor-default'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-60'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-slate-500" />
                <span className="truncate flex-1">{option.name}</span>
                {isCurrent && <Check className="w-4 h-4 flex-shrink-0" aria-label={t('folders.current')} />}
                {movingTo === option.id && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
