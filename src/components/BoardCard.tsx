import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Copy, Trash2, Edit3, ArrowUpRight, Palette } from 'lucide-react';
import { Board } from '../lib/types';
import { formatDateRelative } from '../lib/utils';

interface BoardCardProps {
  board: Board;
  onOpen: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDuplicate: (board: Board) => void;
  onDelete: (id: string) => void;
}

export function BoardCard({
  board,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: BoardCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [title, setTitle] = useState(board.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(board.title);
  }, [board.title]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const elementsCount = Array.isArray(board.elements) ? board.elements.filter((el: any) => !el.isDeleted).length : 0;

  return (
    <div className="group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-xl hover:border-violet-300 dark:hover:border-violet-700/50 transition-all duration-200 flex flex-col justify-between">
      {/* Visual Canvas Thumbnail / Header */}
      <div 
        onClick={() => onOpen(board.id)}
        className="cursor-pointer h-32 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex flex-col items-center justify-center p-3 relative overflow-hidden group-hover:bg-violet-50/30 transition-colors"
      >
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-violet-600">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <Palette className="w-8 h-8 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors mb-2" />
        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
          {elementsCount === 0
            ? 'Quadro vazio'
            : `${elementsCount} ${elementsCount === 1 ? 'elemento' : 'elementos'}`}
        </span>
      </div>

      {/* Info & Title */}
      <div className="mt-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 mr-2">
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleKeyDown}
                className="w-full text-sm font-semibold px-2 py-0.5 rounded bg-violet-50 border border-violet-300 text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:outline-none"
              />
            ) : (
              <h3
                onClick={() => onOpen(board.id)}
                className="text-sm font-semibold text-slate-800 dark:text-white truncate cursor-pointer hover:text-violet-600 transition"
                title={board.title}
              >
                {board.title || 'Quadro sem título'}
              </h3>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {formatDateRelative(board.updated_at || board.created_at)}
            </p>
          </div>

          {/* Menu Button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-500 transition"
              title="Opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 bottom-8 sm:bottom-auto sm:top-8 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 py-1.5 z-20 animate-in fade-in zoom-in-95">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setIsRenaming(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center space-x-2"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Renomear</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDuplicate(board);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center space-x-2"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Duplicar</span>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(board.id);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 flex items-center space-x-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
