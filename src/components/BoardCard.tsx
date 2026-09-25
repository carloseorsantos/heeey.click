import { forwardRef, useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { MoreHorizontal, Copy, Trash2, Edit3, RotateCcw, FolderInput, FolderKanban, Globe } from 'lucide-react';
import { Board } from '../lib/types';
import { BoardSnippet } from '../lib/search';
import { cn, formatDateRelative } from '../lib/utils';
import { spring } from '../lib/motion';
import { useDismiss } from '../hooks/useDismiss';
import { useTheme } from '../hooks/useTheme';
import { BoardThumbnail } from './BoardThumbnail';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { useI18n } from '../i18n';

interface BoardCardProps {
  board: Board;
  onOpen: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  /** Absent when the user cannot create boards here (e.g. team viewers) */
  onDuplicate?: (board: Board) => void;
  onDelete: (id: string) => void;
  /** The user only reads this board: no rename, move or trash */
  readOnly?: boolean;
  /** Move to another project (or team) */
  onMoveToProject?: (board: Board) => void;
  onThumbnailGenerated?: (boardId: string, thumbnail: string) => void;
  /** Present when folders are available (signed-in owners) */
  onMove?: (board: Board) => void;
  /** Search result excerpt from the board's canvas text */
  snippet?: BoardSnippet;
  /** Present when the card is shown in the trash */
  trash?: {
    /** Absent when the user cannot restore it (only people who edit it) */
    onRestore?: (id: string) => void;
    /** Only the authenticated owner can delete permanently */
    onDeletePermanently?: (board: Board) => void;
  };
}

export const BoardCard = forwardRef<HTMLElement, BoardCardProps>(function BoardCard(
  { board, onOpen, onRename, onDuplicate, onDelete, onThumbnailGenerated, onMove, snippet, trash, readOnly, onMoveToProject },
  forwardedRef
) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [title, setTitle] = useState(board.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useDismiss<HTMLDivElement>(showMenu, () => setShowMenu(false));

  useEffect(() => {
    setTitle(board.title);
  }, [board.title]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  function handleRenameSubmit() {
    setIsRenaming(false);
    if (title.trim() && title !== board.title) {
      onRename(board.id, title.trim());
    } else {
      setTitle(board.title);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setTitle(board.title);
      setIsRenaming(false);
    }
  }

  function run(action: () => void) {
    setShowMenu(false);
    action();
  }

  const displayTitle = board.title || t('board.untitled');

  return (
    <motion.article
      ref={forwardedRef}
      layout="position"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      transition={spring.default}
      // Right-click opens the same actions, like a native context menu
      onContextMenu={(e) => {
        if (isRenaming) return;
        e.preventDefault();
        setShowMenu(true);
      }}
      className="group relative flex flex-col min-w-0"
    >
      {/* Canvas preview */}
      <div
        aria-hidden="true"
        className={cn(
          'relative aspect-[4/3] w-full rounded-2xl bg-surface overflow-hidden shadow-card',
          'transition-[box-shadow,transform] duration-300 ease-out',
          'group-hover:shadow-card-hover group-has-[.card-link:active]:scale-[0.985] group-has-[.card-link:active]:duration-100',
          'group-focus-within:shadow-card-hover',
          trash && 'opacity-70'
        )}
      >
        <BoardThumbnail board={board} isDark={isDark} onThumbnailGenerated={onThumbnailGenerated} />
      </div>

      {/* Title + meta */}
      <div className="mt-2.5 flex items-start gap-1">
        <div className="min-w-0 flex-1 px-0.5">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              aria-label={t('boardCard.newName')}
              className="field h-7 -mx-1.5 px-1.5 text-sm font-medium w-[calc(100%+0.75rem)]"
            />
          ) : (
            <h3 className="text-sm font-medium text-label truncate" title={displayTitle}>
              <button
                type="button"
                onClick={() => onOpen(board.id)}
                className="card-link max-w-full truncate text-left outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
              >
                {displayTitle}
              </button>
            </h3>
          )}
          <p className="text-xs text-label-2 mt-0.5 truncate flex items-center gap-1">
            {!trash && (board.access_level === 'edit' || board.access_level === 'view') && board.team_id && (
              <Globe className="w-3 h-3 flex-shrink-0" aria-label={t('boardCard.linkOpen')} />
            )}
            {trash && board.deleted_at
              ? t('boardCard.inTrashSince', { time: formatDateRelative(board.deleted_at) })
              : t('boardCard.edited', { time: formatDateRelative(board.updated_at || board.created_at) })}
          </p>
          {snippet && (
            <p className="mt-1 text-xs text-label-2 line-clamp-2 break-words">
              {snippet.before}
              <mark className="rounded-[3px] px-0.5 bg-[#ffd60a]/40 text-label">{snippet.match}</mark>
              {snippet.after}
            </p>
          )}
        </div>

        {/* Options menu (sits above the card-wide click target) */}
        <div className="relative z-10 -mr-1.5" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className={cn(
              'pressable w-8 h-8 flex items-center justify-center rounded-full text-label-2 hover:text-label hover:bg-fill',
              '[@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              showMenu && 'opacity-100 [@media(hover:hover)]:opacity-100 bg-fill text-label'
            )}
            aria-haspopup="menu"
            aria-expanded={showMenu}
            aria-label={t('boardCard.options', { title: displayTitle })}
          >
            <MoreHorizontal className="w-[18px] h-[18px]" />
          </button>

          <Menu open={showMenu} className="w-56">
            {trash ? (
              <>
                {trash.onRestore && (
                  <MenuItem icon={RotateCcw} onClick={() => run(() => trash.onRestore?.(board.id))}>
                    {t('common.restore')}
                  </MenuItem>
                )}
                {!trash.onRestore && !trash.onDeletePermanently && (
                  <p className="px-2.5 py-2 text-xs text-label-2">{t('boardCard.noTrashActions')}</p>
                )}
                {trash.onDeletePermanently && (
                  <>
                    <MenuSeparator />
                    <MenuItem icon={Trash2} destructive onClick={() => run(() => trash.onDeletePermanently?.(board))}>
                      {t('boardCard.deletePermanently')}
                    </MenuItem>
                  </>
                )}
              </>
            ) : (
              <>
                {!readOnly && (
                  <MenuItem icon={Edit3} onClick={() => run(() => setIsRenaming(true))}>
                    {t('common.rename')}
                  </MenuItem>
                )}
                {onDuplicate && (
                  <MenuItem icon={Copy} onClick={() => run(() => onDuplicate(board))}>
                    {t('boardCard.duplicate')}
                  </MenuItem>
                )}
                {onMove && !readOnly && (
                  <MenuItem icon={FolderInput} onClick={() => run(() => onMove(board))}>
                    {t('boardCard.moveToFolder')}
                  </MenuItem>
                )}
                {onMoveToProject && !readOnly && (
                  <MenuItem icon={FolderKanban} onClick={() => run(() => onMoveToProject(board))}>
                    {t('boardCard.moveToProject')}
                  </MenuItem>
                )}
                {!readOnly && (
                  <>
                    <MenuSeparator />
                    <MenuItem icon={Trash2} destructive onClick={() => run(() => onDelete(board.id))}>
                      {t('boardCard.moveToTrash')}
                    </MenuItem>
                  </>
                )}
                {readOnly && !onDuplicate && <p className="px-2.5 py-2 text-xs text-label-2">{t('boardCard.readOnly')}</p>}
              </>
            )}
          </Menu>
        </div>
      </div>
    </motion.article>
  );
});
