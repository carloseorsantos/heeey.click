import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, FileText } from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';
import { Board } from '../lib/types';
import { fetchBoardSummaries } from '../lib/boardQueries';
import { getLocalBoards, isBoardLocallyCreated } from '../lib/storage';
import { BoardSearchHit, getSearchTerms, searchBoardsRemote, searchLoadedBoards } from '../lib/search';
import { formatDateRelative } from '../lib/utils';
import { useI18n } from '../i18n';

interface BoardSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoardId: string;
  onOpenBoard: (boardId: string) => void;
}

const RECENT_LIMIT = 8;

/** Jump to another board by title or canvas text, from inside the editor */
export function BoardSearchModal({ isOpen, onClose, currentBoardId, onOpenBoard }: BoardSearchModalProps) {
  const { user, guestProfile } = useAuth();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [ownBoards, setOwnBoards] = useState<Board[]>([]);
  const [hits, setHits] = useState<BoardSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Boards the person can jump to: their account's boards, or this browser's guest boards
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    let cancelled = false;
    (async () => {
      const list = user?.id
        ? (await fetchBoardSummaries(user.id)) || []
        : getLocalBoards().filter((b) => !b.owner_id && isBoardLocallyCreated(b.id, guestProfile.id));
      if (cancelled) return;
      setOwnBoards(
        list
          .filter((b) => !b.deleted_at && b.id !== currentBoardId)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id, guestProfile.id, currentBoardId]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    setActiveIndex(0);
    if (getSearchTerms(trimmed).length === 0) {
      setHits(ownBoards.slice(0, RECENT_LIMIT).map((board) => ({ board })));
      setLoading(false);
      return;
    }

    const local = searchLoadedBoards(ownBoards, trimmed);
    setHits(local);
    if (!user?.id) return;

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const remote = await searchBoardsRemote(trimmed);
      if (cancelled) return;
      setLoading(false);
      if (!remote) return; // keep title matches when content search is unavailable
      const merged = new Map(local.map((hit) => [hit.board.id, hit]));
      for (const hit of remote) {
        if (hit.board.id === currentBoardId) continue;
        const existing = merged.get(hit.board.id);
        merged.set(hit.board.id, existing ? { ...existing, snippet: existing.snippet ?? hit.snippet } : hit);
      }
      setHits(Array.from(merged.values()));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, ownBoards, isOpen, user?.id, currentBoardId]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function open(boardId: string) {
    onClose();
    onOpenBoard(boardId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[activeIndex]) {
      e.preventDefault();
      open(hits[activeIndex].board.id);
    }
  }

  const isQueryEmpty = getSearchTerms(query).length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('search.jumpTitle')}
      description={t('search.jumpDescription')}
      icon={
        <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 flex-shrink-0">
          <Search className="w-5 h-5" />
        </div>
      }
    >
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
          aria-controls="board-search-results"
          autoFocus
          className="w-full h-11 pl-9 pr-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {loading && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" aria-label={t('search.searching')} />
        )}
      </div>

      <p className="mt-4 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {isQueryEmpty ? t('search.recent') : t('search.results')}
      </p>
      {hits.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400" role="status">
          {isQueryEmpty ? t('search.noOtherBoards') : loading ? t('search.searching') : t('search.noResults')}
        </p>
      ) : (
        <ul id="board-search-results" ref={listRef} className="max-h-[50vh] overflow-y-auto -mx-2 space-y-0.5">
          {hits.map(({ board, snippet, related }, index) => (
            <li key={board.id}>
              <button
                data-index={index}
                onClick={() => open(board.id)}
                onMouseMove={() => setActiveIndex(index)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                  index === activeIndex ? 'bg-slate-100 dark:bg-slate-800' : ''
                }`}
              >
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-white truncate">
                    {board.title || t('board.untitled')}
                  </span>
                  {snippet ? (
                    <span className="block text-xs text-slate-600 dark:text-slate-300 truncate">
                      {snippet.before}
                      <mark className="rounded px-0.5 bg-amber-100 text-slate-900 dark:bg-amber-400/25 dark:text-amber-100">
                        {snippet.match}
                      </mark>
                      {snippet.after}
                    </span>
                  ) : (
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {related && <span className="font-medium text-brand-600 dark:text-brand-400">{t('search.related')} · </span>}
                      {t('boardCard.edited', { time: formatDateRelative(board.updated_at || board.created_at) })}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
