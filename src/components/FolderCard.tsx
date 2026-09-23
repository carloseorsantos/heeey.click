import { useState } from 'react';
import { Folder as FolderIcon, MoreVertical, Edit3, Trash2 } from 'lucide-react';
import { Folder } from '../lib/folders';
import { useDismiss } from '../hooks/useDismiss';
import { useI18n } from '../i18n';

interface FolderCardProps {
  folder: Folder;
  itemCount: number;
  onOpen: (id: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

const menuItemClass =
  'w-full text-left px-3 py-2 text-sm flex items-center gap-2 focus:outline-none';

export function FolderCard({ folder, itemCount, onOpen, onRename, onDelete }: FolderCardProps) {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useDismiss<HTMLDivElement>(showMenu, () => setShowMenu(false));

  return (
    <article className="group relative flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700/50 focus-within:border-brand-400 transition-[box-shadow,border-color]">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
        <FolderIcon className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white truncate" title={folder.name}>
          <button
            type="button"
            onClick={() => onOpen(folder.id)}
            className="max-w-full truncate text-left hover:text-brand-700 dark:hover:text-brand-300 transition focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-500 after:absolute after:inset-0 after:rounded-2xl after:content-['']"
          >
            {folder.name}
          </button>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('folders.items', { count: itemCount })}
        </p>
      </div>

      <div className="relative z-10" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowMenu((v) => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
          aria-haspopup="menu"
          aria-expanded={showMenu}
          aria-label={t('folders.options', { name: folder.name })}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {showMenu && (
          <div
            role="menu"
            className="absolute right-0 top-10 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 py-1.5 z-20 animate-pop-in origin-top-right"
          >
            <button
              role="menuitem"
              onClick={() => {
                setShowMenu(false);
                onRename(folder);
              }}
              className={`${menuItemClass} text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800`}
            >
              <Edit3 className="w-4 h-4 text-slate-500" />
              <span>{t('common.rename')}</span>
            </button>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button
              role="menuitem"
              onClick={() => {
                setShowMenu(false);
                onDelete(folder);
              }}
              className={`${menuItemClass} text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:focus-visible:bg-rose-950/40`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('folders.delete')}</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
