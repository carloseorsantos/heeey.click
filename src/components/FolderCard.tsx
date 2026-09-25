import { forwardRef, useState } from 'react';
import { motion } from 'motion/react';
import { Folder as FolderIcon, MoreHorizontal, Edit3, Trash2 } from 'lucide-react';
import { Folder } from '../lib/folders';
import { cn } from '../lib/utils';
import { spring } from '../lib/motion';
import { useDismiss } from '../hooks/useDismiss';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { useI18n } from '../i18n';

interface FolderCardProps {
  folder: Folder;
  itemCount: number;
  onOpen: (id: string) => void;
  /** Absent for people who only read the project */
  onRename?: (folder: Folder) => void;
  onDelete?: (folder: Folder) => void;
}

export const FolderCard = forwardRef<HTMLElement, FolderCardProps>(function FolderCard(
  { folder, itemCount, onOpen, onRename, onDelete },
  forwardedRef
) {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useDismiss<HTMLDivElement>(showMenu, () => setShowMenu(false));

  function run(action: () => void) {
    setShowMenu(false);
    action();
  }

  return (
    <motion.article
      ref={forwardedRef}
      layout="position"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      transition={spring.default}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      className={cn(
        'group relative flex items-center gap-3 h-16 pl-3 pr-1.5 rounded-2xl bg-surface shadow-card',
        'transition-[box-shadow,transform] duration-300 ease-out hover:shadow-card-hover focus-within:shadow-card-hover',
        'has-[.card-link:active]:scale-[0.98] has-[.card-link:active]:duration-100'
      )}
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-accent/10 text-accent-text">
        <FolderIcon className="w-5 h-5" fill="currentColor" fillOpacity={0.18} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-label truncate" title={folder.name}>
          <button
            type="button"
            onClick={() => onOpen(folder.id)}
            className="card-link max-w-full truncate text-left outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
          >
            {folder.name}
          </button>
        </h3>
        <p className="text-xs text-label-2">{t('folders.items', { count: itemCount })}</p>
      </div>

      {onRename && onDelete && (
      <div className="relative z-10" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowMenu((v) => !v)}
          className={cn(
            'pressable w-8 h-8 flex items-center justify-center rounded-full text-label-2 hover:text-label hover:bg-fill',
            '[@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            showMenu && '[@media(hover:hover)]:opacity-100 bg-fill text-label'
          )}
          aria-haspopup="menu"
          aria-expanded={showMenu}
          aria-label={t('folders.options', { name: folder.name })}
        >
          <MoreHorizontal className="w-[18px] h-[18px]" />
        </button>
        <Menu open={showMenu} className="w-52">
          <MenuItem icon={Edit3} onClick={() => run(() => onRename(folder))}>
            {t('common.rename')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={Trash2} destructive onClick={() => run(() => onDelete(folder))}>
            {t('folders.delete')}
          </MenuItem>
        </Menu>
      </div>
      )}
    </motion.article>
  );
});
