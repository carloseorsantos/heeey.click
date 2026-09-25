import { useState } from 'react';
import { FolderInput, Folder as FolderIcon, Home, Check, Loader2 } from 'lucide-react';
import { Modal, ModalIcon } from './Modal';
import { Folder, flattenFolderTree } from '../lib/folders';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';

interface MoveToFolderModalProps {
  isOpen: boolean;
  itemName: string;
  /** Name of the top level (the project, or "My boards") */
  rootName?: string;
  folders: Folder[];
  currentFolderId: string | null;
  onClose: () => void;
  onMove: (folderId: string | null) => Promise<boolean>;
}

export function MoveToFolderModal({
  isOpen,
  itemName,
  rootName,
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
    { id: null, name: rootName ?? t('folders.root'), depth: 0 },
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
        <ModalIcon>
          <FolderInput />
        </ModalIcon>
      }
    >
      {error && (
        <p className="mb-3 text-sm text-danger-text" role="alert">
          {t('folders.moveError')}
        </p>
      )}
      <ul className="max-h-[50vh] overflow-y-auto rounded-xl bg-fill p-1 space-y-0.5">
        {options.map((option) => {
          const isCurrent = option.id === currentFolderId;
          const Icon = option.id === null ? Home : FolderIcon;
          return (
            <li key={option.id ?? 'root'}>
              <button
                onClick={() => handleMove(option.id)}
                disabled={isCurrent || movingTo !== undefined}
                style={{ paddingLeft: `${0.625 + option.depth * 1}rem` }}
                className={cn(
                  'w-full h-10 flex items-center gap-2.5 pr-3 rounded-lg text-sm text-left transition-colors',
                  isCurrent ? 'text-label-2 cursor-default' : 'text-label hover:bg-fill-2 disabled:opacity-50'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-accent-text" />
                <span className="truncate flex-1">{option.name}</span>
                {isCurrent && <Check className="w-4 h-4 flex-shrink-0 text-accent-text" strokeWidth={2.75} aria-label={t('folders.current')} />}
                {movingTo === option.id && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-label-2" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
