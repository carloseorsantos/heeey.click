import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Copy, Trash2, Edit3, RotateCcw, FolderInput } from 'lucide-react';
import { Board } from '../lib/types';
import { BoardSnippet } from '../lib/search';
import { formatDateRelative } from '../lib/utils';
import { useDismiss } from '../hooks/useDismiss';
import { useTheme } from '../hooks/useTheme';
import { BoardThumbnail } from './BoardThumbnail';
import { useI18n } from '../i18n';

interface BoardCardProps {
  board: Board;
  onOpen: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDuplicate: (board: Board) => void;
  onDelete: (id: string) => void;
  onThumbnailGenerated?: (boardId: string, thumbnail: string) => void;
  /** Present when folders are available (signed-in owners) */
  onMove?: (board: Board) => void;
  /** Search result excerpt from the board's canvas text */
  snippet?: BoardSnippet;
  /** Present when the card is shown in the trash */
  trash?: {
    onRestore: (id: string) => void;
    /** Only the authenticated owner can delete permanently */
    onDeletePermanently?: (board: Board) => void;
  };
}

const menuItemClass =
  'w-full text-left px-3 py-2 text-sm flex items-center gap-2 focus:outline-none';

export function BoardCard({
  board,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onThumbnailGenerated,
  onMove,
  snippet,
  trash,
}: BoardCardProps) {
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

  const displayTitle = board.title || t('board.untitled');

  return (
    <article className="group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-sm hover:shadow-lg hover:border-brand-300 dark:hover:border-brand-700/50 focus-within:border-brand-400 transition-all duration-200 flex flex-col">
      {/* Canvas preview */}
      <div
        aria-hidden="true"
        className="h-36 w-full rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 overflow-hidden group-hover:bg-brand-50/40 dark:group-hover:bg-slate-800 transition-colors"
      >
        <BoardThumbnail board={board} isDark={isDark} onThumbnailGenerated={onThumbnailGenerated} />
      </div>

      {/* Title + meta */}
      <div className="mt-3 flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1 px-1">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              aria-label={t('boardCard.newName')}
              className="w-full text-sm font-semibold px-2 py-1 -mx-2 rounded-lg bg-brand-50 border border-brand-300 text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          ) : (
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white truncate" title={displayTitle}>
              <button
                type="button"
                onClick={() => onOpen(board.id)}
                className="max-w-full truncate text-left hover:text-brand-700 dark:hover:text-brand-300 transition focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-500 after:absolute after:inset-0 after:rounded-2xl after:content-['']"
              >
                {displayTitle}
              </button>
            </h3>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {trash && board.deleted_at
              ? t('boardCard.inTrashSince', { time: formatDateRelative(board.deleted_at) })
              : t('boardCard.edited', { time: formatDateRelative(board.updated_at || board.created_at) })}
          </p>
          {snippet && (
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 break-words">
              {snippet.before}
              <mark className="rounded px-0.5 bg-amber-100 text-slate-900 dark:bg-amber-400/25 dark:text-amber-100">
                {snippet.match}
              </mark>
              {snippet.after}
            </p>
          )}
        </div>

        {/* Options menu (sits above the card-wide click target) */}
        <div className="relative z-10" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
            aria-haspopup="menu"
            aria-expanded={showMenu}
            aria-label={t('boardCard.options', { title: displayTitle })}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div
              role="menu"
              className="absolute right-0 bottom-10 sm:bottom-auto sm:top-10 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 py-1.5 z-20 animate-pop-in"
            >
              {trash ? (
                <>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      trash.onRestore(board.id);
                    }}
                    className={`${menuItemClass} text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800`}
                  >
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span>{t('common.restore')}</span>
                  </button>

                  {trash.onDeletePermanently && (
                    <>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                      <button
                        role="menuitem"
                        onClick={() => {
                          setShowMenu(false);
                          trash.onDeletePermanently?.(board);
                        }}
                        className={`${menuItemClass} text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:focus-visible:bg-rose-950/40`}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t('boardCard.deletePermanently')}</span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      setIsRenaming(true);
                    }}
                    className={`${menuItemClass} text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800`}
                  >
                    <Edit3 className="w-4 h-4 text-slate-500" />
                    <span>{t('common.rename')}</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate(board);
                    }}
                    className={`${menuItemClass} text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800`}
                  >
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>{t('boardCard.duplicate')}</span>
                  </button>

                  {onMove && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowMenu(false);
                        onMove(board);
                      }}
                      className={`${menuItemClass} text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800`}
                    >
                      <FolderInput className="w-4 h-4 text-slate-500" />
                      <span>{t('boardCard.moveToFolder')}</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(board.id);
                    }}
                    className={`${menuItemClass} text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:focus-visible:bg-rose-950/40`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('boardCard.moveToTrash')}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
