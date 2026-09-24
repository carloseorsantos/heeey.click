import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus,
  Search,
  LogIn,
  LayoutGrid,
  Workflow,
  Lightbulb,
  PanelsTopLeft,
  X,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Folder as FolderIcon,
  BookOpen,
  Settings,
  Info,
} from 'lucide-react';
import { Board } from '../lib/types';
import { supabase } from '../lib/supabase';
import {
  getLocalBoards,
  saveLocalBoard,
  updateLocalBoardMeta,
  deleteLocalBoard,
  markBoardAsCreated,
  isBoardLocallyCreated,
} from '../lib/storage';
import { fetchBoardSummaries, fetchBoardContent, saveBoardThumbnail } from '../lib/boardQueries';
import {
  generateId,
  getBrainstormingTemplate,
  getFlowchartTemplate,
  getWireframeTemplate,
} from '../lib/utils';
import { setBoardTrashed, deleteBoardPermanently } from '../lib/boardTrash';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { BoardCard } from '../components/BoardCard';
import { HeeeyLogo, HeeeyWordmark } from '../components/Logo';
import { Modal, ModalIcon } from '../components/Modal';
import { AccountMenu } from '../components/AccountMenu';
import { Button } from '../components/ui/Button';
import { Toast, type ToastData } from '../components/ui/Toast';
import { FolderCard } from '../components/FolderCard';
import { FolderNameModal } from '../components/FolderNameModal';
import { MoveToFolderModal } from '../components/MoveToFolderModal';
import { STATIC_PAGES, useI18n, type MessageKey } from '../i18n';
import { useFolders } from '../hooks/useFolders';
import { Folder, flattenFolderTree, getFolderPath, moveBoardToFolder } from '../lib/folders';
import { cn } from '../lib/utils';
import { BoardSearchHit, searchBoardsRemote, searchLoadedBoards } from '../lib/search';

interface DashboardPageProps {
  onNavigateToBoard: (boardId: string) => void;
  onNavigateToDocs?: () => void;
}

const TOAST_MS = 5000;

interface TemplateOption {
  title: MessageKey;
  boardTitle: MessageKey;
  description: MessageKey;
  Icon: typeof Lightbulb;
  iconClass: string;
  getElements: () => any[];
}

const TEMPLATES: TemplateOption[] = [
  {
    title: 'dashboard.templates.brainstorming.title',
    boardTitle: 'dashboard.templates.brainstorming.boardTitle',
    description: 'dashboard.templates.brainstorming.description',
    Icon: Lightbulb,
    iconClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    getElements: getBrainstormingTemplate,
  },
  {
    title: 'dashboard.templates.flowchart.title',
    boardTitle: 'dashboard.templates.flowchart.boardTitle',
    description: 'dashboard.templates.flowchart.description',
    Icon: Workflow,
    iconClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    getElements: getFlowchartTemplate,
  },
  {
    title: 'dashboard.templates.wireframe.title',
    boardTitle: 'dashboard.templates.wireframe.boardTitle',
    description: 'dashboard.templates.wireframe.description',
    Icon: PanelsTopLeft,
    iconClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    getElements: getWireframeTemplate,
  },
];

const TEMPLATE_CARD =
  'pressable w-[9.5rem] sm:w-auto flex-shrink-0 snap-start flex flex-col items-start gap-3 p-4 rounded-2xl text-left bg-surface shadow-card hover:shadow-card-hover';

const GRID = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-x-4 sm:gap-x-5 gap-y-6 sm:gap-y-7';

function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon?: typeof Trash2;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-16 px-6"
    >
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-fill text-label-2 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7" strokeWidth={1.75} />
        </div>
      )}
      <h2 className="text-lg font-semibold text-label">{title}</h2>
      {body && <p className="text-sm text-label-2 max-w-sm mt-1">{body}</p>}
      {children && <div className="mt-5">{children}</div>}
    </motion.div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  selected,
  depth = 0,
  badge,
  onClick,
}: {
  icon: typeof Trash2;
  label: string;
  selected?: boolean;
  depth?: number;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'page' : undefined}
      style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
      className={cn(
        'w-full h-8 flex items-center gap-2 pr-2 rounded-lg text-sm text-left transition-colors duration-100',
        selected ? 'bg-fill-2 text-label font-medium' : 'text-label hover:bg-fill'
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', selected ? 'text-accent-text' : 'text-label-2')} />
      <span className="flex-1 truncate">{label}</span>
      {!!badge && <span className="text-xs text-label-2 tabular-nums">{badge}</span>}
    </button>
  );
}

export function DashboardPage({ onNavigateToBoard, onNavigateToDocs }: DashboardPageProps) {
  const { user, isAuthenticated, guestProfile } = useAuth();
  const { t, locale } = useI18n();
  const untitled = t('board.untitled');

  useEffect(() => {
    document.title = t('app.documentTitle');
  }, [t]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { openSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'boards' | 'trash'>('boards');
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastIdRef = useRef(0);
  const [boardToPurge, setBoardToPurge] = useState<Board | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    folders,
    available: foldersAvailable,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useFolders(user?.id);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderModal, setFolderModal] = useState<{ mode: 'create' } | { mode: 'rename'; folder: Folder } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [boardToMove, setBoardToMove] = useState<Board | null>(null);
  // Canvas-text search (server-side for signed-in users); null = not available
  const [remoteHits, setRemoteHits] = useState<BoardSearchHit[] | null>(null);
  const [isSearchingContent, setIsSearchingContent] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Scroll edge effect: chrome turns into a material only when content is under it
  const [isScrolled, setIsScrolled] = useState(false);
  const [isTitleHidden, setIsTitleHidden] = useState(false);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    setIsScrolled(container.scrollTop > 2);
    const title = titleRef.current;
    if (title) {
      const top = container.getBoundingClientRect().top;
      setIsTitleHidden(title.getBoundingClientRect().bottom < top + 56);
    }
  }

  useEffect(() => {
    const query = searchQuery.trim();
    if (!user?.id || view === 'trash' || !query) {
      setRemoteHits(null);
      setIsSearchingContent(false);
      return;
    }
    let cancelled = false;
    setIsSearchingContent(true);
    const timer = setTimeout(async () => {
      const hits = await searchBoardsRemote(query);
      if (cancelled) return;
      setRemoteHits(hits);
      setIsSearchingContent(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, user?.id, view]);

  // "/" focuses the search box, like in many web apps
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load boards from Supabase and merge with local boards
  useEffect(() => {
    async function loadBoards() {
      setLoading(true);
      const localList = getLocalBoards();

      try {
        if (user?.id) {
          // Authenticated: load light summaries (no scene data) of the user's boards
          const data = await fetchBoardSummaries(user.id);

          if (data) {
            const remoteMap = new Map<string, Board>();
            data.forEach((b) => remoteMap.set(b.id, b));

            // Include local boards belonging to this user or created by the active guest session
            localList.forEach((local) => {
              if (
                !remoteMap.has(local.id) &&
                (local.owner_id === user.id || (!local.owner_id && isBoardLocallyCreated(local.id, guestProfile.id)))
              ) {
                remoteMap.set(local.id, local);
              }
            });

            const merged = Array.from(remoteMap.values()).sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );

            setBoards(merged);
            setLoading(false);
            return;
          }
        } else {
          // Unauthenticated guest: display only unowned boards created in the current active session
          const myLocalBoards = localList.filter(
            (b) => !b.owner_id && isBoardLocallyCreated(b.id, guestProfile.id)
          );
          setBoards(myLocalBoards);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Erro ao carregar do Supabase:', err);
      }

      const fallback = localList.filter(
        (b) =>
          (user?.id && b.owner_id === user.id) ||
          (!b.owner_id && isBoardLocallyCreated(b.id, guestProfile.id))
      );
      setBoards(fallback);
      setLoading(false);
    }

    loadBoards();
  }, [user?.id, guestProfile.id]);

  function handleCreateBoard(templateTitle?: string, initialElements?: any[]) {
    const newId = generateId();
    const newBoard: Board = {
      id: newId,
      title: templateTitle || untitled,
      owner_id: user?.id || null,
      elements: initialElements || [],
      app_state: {
        viewBackgroundColor: '#ffffff',
        currentItemStrokeColor: '#1e1e1e',
        currentItemBackgroundColor: 'transparent',
      },
      files: {},
      access_level: 'edit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // New boards land in the folder being viewed
      ...(activeFolderId ? { folder_id: activeFolderId } : {}),
    };

    markBoardAsCreated(newId);
    saveLocalBoard(newBoard);
    setBoards((prev) => [newBoard, ...prev]);

    // Try saving to Supabase
    (async () => {
      try {
        await supabase.from('boards').insert(newBoard);
      } catch (e) {
        // Ignore network errors
      }
    })();

    onNavigateToBoard(newId);
  }

  function handleRename(id: string, newTitle: string) {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          const updated = { ...b, title: newTitle, updated_at: new Date().toISOString() };
          updateLocalBoardMeta(id, { title: updated.title, updated_at: updated.updated_at });
          (async () => {
            try {
              await supabase
                .from('boards')
                .update({ title: newTitle, updated_at: new Date().toISOString() })
                .eq('id', id);
            } catch (e) {}
          })();
          return updated;
        }
        return b;
      })
    );
  }

  async function handleDuplicate(source: Board) {
    // Dashboard summaries do not carry the scene: load it before copying
    let board = source;
    if (source.contentLoaded === false) {
      const content = await fetchBoardContent(source.id);
      if (!content) {
        showToast({ message: t('dashboard.duplicateError') });
        return;
      }
      board = { ...source, ...content };
    }

    const { contentLoaded: _contentLoaded, ...boardData } = board;
    const newId = generateId();
    const duplicate: Board = {
      ...boardData,
      id: newId,
      title: t('dashboard.copySuffix', { title: board.title }),
      owner_id: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    markBoardAsCreated(newId);
    saveLocalBoard(duplicate);
    setBoards((prev) => [duplicate, ...prev]);

    (async () => {
      try {
        await supabase.from('boards').insert(duplicate);
      } catch (e) {}
    })();
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(next: Omit<ToastData, 'id'>) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ ...next, id: ++toastIdRef.current });
    toastTimerRef.current = setTimeout(hideToast, TOAST_MS);
  }

  function hideToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }

  function applyTrashedLocally(id: string, deletedAt: string | null) {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        updateLocalBoardMeta(id, { deleted_at: deletedAt });
        return { ...b, deleted_at: deletedAt };
      })
    );
  }

  // Optimistic: 'not-found' is fine (board only exists locally), a server error rolls back
  function setTrashed(id: string, trashed: boolean) {
    const now = new Date().toISOString();
    // Rolling back means going to the opposite state (undo callbacks may hold stale board data)
    const rollback = trashed ? null : boards.find((b) => b.id === id)?.deleted_at || now;
    applyTrashedLocally(id, trashed ? now : null);
    setBoardTrashed(id, trashed).then((result) => {
      if (result !== 'error') return;
      applyTrashedLocally(id, rollback);
      showToast({
        message: trashed
          ? t('dashboard.trashError')
          : t('dashboard.restoreError'),
      });
    });
  }

  function handleMoveToTrash(id: string) {
    const board = boards.find((b) => b.id === id);
    if (!board) return;
    setTrashed(id, true);
    showToast({
      message: t('dashboard.movedToTrash', { title: board.title || untitled }),
      onUndo: () => setTrashed(id, false),
    });
  }

  function handleRestore(id: string) {
    const board = boards.find((b) => b.id === id);
    if (!board) return;
    setTrashed(id, false);
    showToast({
      message: t('dashboard.restored', { title: board.title || untitled }),
      onUndo: () => setTrashed(id, true),
    });
  }

  async function handleConfirmPurge() {
    if (!boardToPurge) return;
    const { id, title } = boardToPurge;
    setIsPurging(true);
    const ok = await deleteBoardPermanently(id);
    setIsPurging(false);
    setBoardToPurge(null);

    if (ok) {
      deleteLocalBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
      showToast({ message: t('dashboard.deletedPermanently', { title: title || untitled }) });
    } else {
      showToast({ message: t('dashboard.deleteError') });
    }
  }

  function handleThumbnailGenerated(id: string, thumbnail: string) {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, thumbnail } : b)));
    updateLocalBoardMeta(id, { thumbnail });
    saveBoardThumbnail(id, thumbnail);
  }

  async function handleCreateFolder(name: string) {
    return !!(await createFolder(name, activeFolderId));
  }

  async function handleConfirmDeleteFolder() {
    if (!folderToDelete) return;
    const folder = folderToDelete;
    setIsDeletingFolder(true);
    const removed = await deleteFolder(folder.id);
    setIsDeletingFolder(false);
    setFolderToDelete(null);

    if (!removed) {
      showToast({ message: t('dashboard.folderDeleteError') });
      return;
    }
    // Boards inside go back to the root (the database does the same with on delete set null)
    setBoards((prev) =>
      prev.map((b) => {
        if (!b.folder_id || !removed.has(b.folder_id)) return b;
        updateLocalBoardMeta(b.id, { folder_id: null });
        return { ...b, folder_id: null };
      })
    );
    if (activeFolderId && removed.has(activeFolderId)) setCurrentFolderId(folder.parent_id);
    showToast({ message: t('dashboard.folderDeleted', { name: folder.name }) });
  }

  async function handleMoveBoard(folderId: string | null) {
    if (!boardToMove) return false;
    const { id, folder_id: previous = null } = boardToMove;
    const setFolder = (value: string | null) =>
      setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, folder_id: value } : b)));

    setFolder(folderId);
    if (!(await moveBoardToFolder(id, folderId))) {
      setFolder(previous);
      return false;
    }
    updateLocalBoardMeta(id, { folder_id: folderId });
    const target = folders.find((f) => f.id === folderId);
    showToast({ message: t('dashboard.movedTo', { name: target?.name ?? t('dashboard.myBoards') }) });
    return true;
  }

  const activeBoards = boards.filter((b) => !b.deleted_at);
  const trashedBoards = boards.filter((b) => !!b.deleted_at);
  const isTrashView = view === 'trash';

  // Folders: a board or folder pointing to an unknown folder is shown at the root
  const folderIds = new Set(folders.map((f) => f.id));
  const parentOf = (id: string | null | undefined) => (id && folderIds.has(id) ? id : null);
  const activeFolderId = foldersAvailable ? parentOf(currentFolderId) : null;
  const currentFolder = folders.find((f) => f.id === activeFolderId) ?? null;
  const folderPath = getFolderPath(folders, activeFolderId);
  const isSearching = searchQuery.trim().length > 0;
  const showFolders = foldersAvailable && !isTrashView && !isSearching;
  const visibleFolders = showFolders
    ? folders
        .filter((f) => parentOf(f.parent_id) === activeFolderId)
        .sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }))
    : [];
  const folderItemCount = (folderId: string) =>
    activeBoards.filter((b) => parentOf(b.folder_id) === folderId).length +
    folders.filter((f) => f.parent_id === folderId).length;

  // Search covers every folder; otherwise only the folder being viewed
  const visibleBoards = isTrashView
    ? trashedBoards
    : isSearching || !foldersAvailable
      ? activeBoards
      : activeBoards.filter((b) => parentOf(b.folder_id) === activeFolderId);

  // Searching: titles and locally available canvas text, plus server hits in canvas text
  const searchHits: BoardSearchHit[] = [];
  if (isSearching && !isTrashView) {
    const byId = new Map<string, BoardSearchHit>();
    for (const hit of searchLoadedBoards(visibleBoards, searchQuery)) byId.set(hit.board.id, hit);
    const activeById = new Map(visibleBoards.map((b) => [b.id, b]));
    for (const hit of remoteHits || []) {
      const local = activeById.get(hit.board.id);
      const existing = byId.get(hit.board.id);
      if (existing) {
        if (!existing.snippet) existing.snippet = hit.snippet;
      } else if (local) {
        byId.set(local.id, { board: local, snippet: hit.snippet });
      }
    }
    searchHits.push(...byId.values());
  }
  const snippetById = new Map(searchHits.map((hit) => [hit.board.id, hit.snippet]));

  const filteredBoards =
    isSearching && !isTrashView
      ? searchHits.map((hit) => hit.board)
      : visibleBoards.filter((b) => (b.title || '').toLowerCase().includes(searchQuery.toLowerCase()));
  // Trashed boards still count, so trashing the last board does not jump back to the hero
  const isFirstRun = !loading && boards.length === 0 && folders.length === 0;

  const pageTitle = isTrashView ? t('dashboard.trash') : currentFolder?.name ?? t('dashboard.myBoards');
  // iOS-style back button names the place it goes back to
  const backTarget = isTrashView
    ? { label: t('dashboard.myBoards'), aria: t('dashboard.backToBoards'), go: () => setView('boards') }
    : currentFolder
      ? {
          label: folders.find((f) => f.id === parentOf(currentFolder.parent_id))?.name ?? t('dashboard.myBoards'),
          aria: t('dashboard.backToParent'),
          go: () => setCurrentFolderId(currentFolder.parent_id ?? null),
        }
      : null;

  function goToFolder(id: string | null) {
    setView('boards');
    setSearchQuery('');
    setCurrentFolderId(id);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  function openTrash() {
    setView('trash');
    setSearchQuery('');
    scrollRef.current?.scrollTo({ top: 0 });
  }

  const startSection = (
    <section aria-labelledby="templates-heading">
      <h2 id="templates-heading" className="text-base font-semibold text-label mb-3">
        {isFirstRun ? t('dashboard.orStartWithTemplate') : t('dashboard.startWithTemplate')}
      </h2>
      {/* A swipeable row on phones, a grid on wider screens */}
      <div className={cn('flex sm:grid gap-3', isFirstRun ? 'sm:grid-cols-3' : 'sm:grid-cols-4', ' overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 py-1 -my-1 snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}>
        {/* First run already leads with a big "create" button */}
        {!isFirstRun && (
          <button onClick={() => handleCreateBoard()} className={TEMPLATE_CARD}>
            <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent text-white shadow-[inset_0_0.5px_0_rgba(255,255,255,0.3)]">
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <span className="min-w-0 max-w-full">
              <span className="block text-sm font-semibold text-label truncate">{t('dashboard.blankBoard')}</span>
              <span className="block text-xs text-label-2 truncate">{t('dashboard.blankBoardDescription')}</span>
            </span>
          </button>
        )}
        {TEMPLATES.map(({ title, boardTitle, description, Icon, iconClass, getElements }) => (
          <button
            key={title}
            onClick={() => handleCreateBoard(t(boardTitle), getElements())}
            className={TEMPLATE_CARD}
          >
            <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconClass)}>
              <Icon className="w-5 h-5" />
            </span>
            <span className="min-w-0 max-w-full">
              <span className="block text-sm font-semibold text-label truncate">{t(title)}</span>
              <span className="block text-xs text-label-2 truncate">{t(description)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  const searchField = (
    <div className="relative w-full sm:w-64">
      <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-label-2 pointer-events-none" />
      <input
        ref={searchInputRef}
        type="search"
        placeholder={isTrashView ? t('dashboard.searchTrash') : currentFolder ? t('dashboard.searchAllFolders') : t('dashboard.searchBoards')}
        aria-label={isTrashView ? t('dashboard.searchTrashLabel') : t('dashboard.searchLabel')}
        aria-keyshortcuts="/"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')}
        className="field h-9 pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            searchInputRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-label-3 hover:text-label-2"
          aria-label={t('dashboard.clearSearch')}
        >
          <XCircle className="w-4 h-4" fill="currentColor" stroke="rgb(var(--surface))" />
        </button>
      )}
    </div>
  );

  const folderTree = foldersAvailable ? flattenFolderTree(folders) : [];

  return (
    <div className="h-full flex bg-app text-label">
      {/* Sidebar: where am I, where can I go (wide screens) */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col material-sidebar border-r border-separator">
        <div className="h-14 flex items-center px-4 flex-shrink-0">
          <button
            onClick={() => goToFolder(null)}
            className="pressable rounded-lg -mx-1 px-1 py-1"
            aria-label={t('header.home')}
          >
            <HeeeyWordmark />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5" aria-label={t('dashboard.folderPath')}>
          <div className="space-y-0.5">
            <SidebarItem
              icon={LayoutGrid}
              label={t('dashboard.myBoards')}
              selected={!isTrashView && !activeFolderId}
              badge={activeBoards.length}
              onClick={() => goToFolder(null)}
            />
          </div>

          {foldersAvailable && (
            <div>
              <div className="flex items-center justify-between pl-2 pr-0.5 mb-1">
                <span className="section-label">{t('folders.title')}</span>
                <button
                  type="button"
                  onClick={() => setFolderModal({ mode: 'create' })}
                  className="pressable w-6 h-6 flex items-center justify-center rounded-md text-label-2 hover:text-label hover:bg-fill"
                  aria-label={t('folders.new')}
                  title={t('folders.new')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-0.5">
                {folderTree.map(({ folder, depth }) => (
                  <SidebarItem
                    key={folder.id}
                    icon={FolderIcon}
                    label={folder.name}
                    depth={depth}
                    selected={!isTrashView && activeFolderId === folder.id}
                    onClick={() => goToFolder(folder.id)}
                  />
                ))}
                {folderTree.length === 0 && (
                  <p className="px-2 py-1 text-xs text-label-3">{t('folders.new')}…</p>
                )}
              </div>
            </div>
          )}
        </nav>

        <div className="px-3 pt-2 pb-3 space-y-0.5 border-t border-separator">
          <SidebarItem
            icon={Trash2}
            label={t('dashboard.trash')}
            selected={isTrashView}
            badge={trashedBoards.length}
            onClick={openTrash}
          />
          {onNavigateToDocs && (
            <SidebarItem icon={BookOpen} label={t('dashboard.documentation')} onClick={onNavigateToDocs} />
          )}
          {/* ?home: signed-in users are otherwise sent from the landing page straight back here */}
          <SidebarItem icon={Info} label={t('dashboard.aboutHeeey')} onClick={() => window.location.assign(`${STATIC_PAGES.home[locale]}?home`)} />
          <SidebarItem icon={Settings} label={t('settings.title')} onClick={() => openSettings()} />
        </div>
      </aside>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-w-0 h-full overflow-y-auto flex flex-col">
        {/* Toolbar: transparent at rest, translucent material once content scrolls under it */}
        <header
          className={cn(
            'sticky top-0 z-30 h-14 flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 transition-[background-color,box-shadow] duration-200',
            isScrolled ? 'material-chrome shadow-[0_0.5px_0_var(--separator)]' : 'bg-transparent'
          )}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {backTarget ? (
              <button
                onClick={backTarget.go}
                className="pressable flex items-center h-9 pl-1 pr-2 -ml-1 rounded-lg text-accent-text hover:bg-fill min-w-0"
                aria-label={backTarget.aria}
              >
                <ChevronLeft className="w-6 h-6 flex-shrink-0 -mr-0.5" strokeWidth={2.25} />
                <span className="text-[0.9375rem] truncate max-w-[9rem] sm:max-w-[14rem]">{backTarget.label}</span>
              </button>
            ) : (
              <button onClick={() => goToFolder(null)} className="lg:hidden pressable rounded-lg p-1 -ml-1" aria-label={t('header.home')}>
                <HeeeyLogo className="w-8 h-8" />
              </button>
            )}
          </div>

          {/* Compact title fades in as the large title scrolls away */}
          <p
            aria-hidden="true"
            className={cn(
              'absolute left-1/2 -translate-x-1/2 max-w-[40%] truncate text-[0.9375rem] font-semibold text-label transition-opacity duration-200',
              isTitleHidden ? 'opacity-100' : 'opacity-0'
            )}
          >
            {pageTitle}
          </p>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {!isTrashView && trashedBoards.length > 0 && (
              <Button
                variant="plain"
                iconOnly
                onClick={openTrash}
                className="lg:hidden relative"
                aria-label={t('dashboard.openTrash', { count: trashedBoards.length })}
                title={t('dashboard.trash')}
              >
                <Trash2 className="w-[18px] h-[18px]" />
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-label-2 text-surface text-[10px] font-semibold flex items-center justify-center tabular-nums">
                  {trashedBoards.length}
                </span>
              </Button>
            )}
            {showFolders && (
              <Button
                variant="plain"
                iconOnly
                onClick={() => setFolderModal({ mode: 'create' })}
                aria-label={t('folders.new')}
                title={t('folders.new')}
              >
                <FolderPlus className="w-[18px] h-[18px]" />
              </Button>
            )}
            {!isTrashView && (
              <Button variant="primary" size="md" onClick={() => handleCreateBoard()} aria-label={t('dashboard.newBoard')} className="px-3 sm:px-4">
                <Plus className="w-4 h-4" strokeWidth={2.75} />
                <span className="hidden sm:inline">{t('dashboard.newBoard')}</span>
              </Button>
            )}
            {!isAuthenticated && (
              <Button variant="secondary" onClick={() => openSettings('account')} className="hidden sm:inline-flex">
                <LogIn className="w-4 h-4" />
                <span>{t('dashboard.signIn')}</span>
              </Button>
            )}
            <AccountMenu onOpenDocs={onNavigateToDocs} />
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 pt-2 pb-16">
          {isFirstRun ? (
            <div className="space-y-10">
              {/* Welcome: only for people without boards yet */}
              <section className="pt-6 sm:pt-12 max-w-2xl">
                <HeeeyLogo className="w-14 h-14 mb-5 drop-shadow-[0_8px_16px_rgba(124,58,237,0.25)]" />
                <h1 ref={titleRef} className="text-3xl sm:text-4xl font-bold text-label text-balance">
                  {t('dashboard.heroTitle')}
                </h1>
                <p className="text-base sm:text-lg text-label-2 mt-3 max-w-lg text-pretty">{t('dashboard.heroBody')}</p>
                <div className="flex flex-wrap items-center gap-2 mt-6">
                  <Button variant="primary" size="lg" onClick={() => handleCreateBoard()}>
                    <Plus className="w-5 h-5" strokeWidth={2.5} />
                    <span>{t('dashboard.createFirst')}</span>
                  </Button>
                  {onNavigateToDocs && (
                    <Button variant="secondary" size="lg" onClick={onNavigateToDocs}>
                      <BookOpen className="w-[18px] h-[18px]" />
                      <span>{t('dashboard.documentation')}</span>
                    </Button>
                  )}
                </div>
              </section>
              {startSection}
            </div>
          ) : (
            <section aria-labelledby="boards-heading" className="space-y-8">
              {/* Large title + search */}
              <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="min-w-0">
                  {!isTrashView && folderPath.length > 1 && (
                    <nav aria-label={t('dashboard.folderPath')} className="mb-1">
                      <ol className="flex items-center gap-1 text-xs text-label-2 min-w-0">
                        {[{ id: null as string | null, name: t('dashboard.myBoards') }, ...folderPath.slice(0, -1)].map((crumb) => (
                          <li key={crumb.id ?? 'root'} className="flex items-center gap-1 min-w-0">
                            <button onClick={() => goToFolder(crumb.id)} className="truncate max-w-[10rem] hover:text-label">
                              {crumb.name}
                            </button>
                            <ChevronRight className="w-3 h-3 flex-shrink-0 text-label-3" aria-hidden="true" />
                          </li>
                        ))}
                      </ol>
                    </nav>
                  )}
                  <h1
                    ref={titleRef}
                    id="boards-heading"
                    className="text-3xl sm:text-4xl font-bold text-label flex items-baseline gap-2.5 min-w-0"
                  >
                    <span className="truncate">{pageTitle}</span>
                    {!loading && (
                      <span className="text-xl sm:text-2xl font-medium text-label-3 tabular-nums">
                        {isSearching ? filteredBoards.length : visibleBoards.length}
                      </span>
                    )}
                  </h1>
                  {isTrashView && (
                    <p className="mt-1.5 text-sm text-label-2 max-w-xl">
                      {t('dashboard.trashNote')}
                      {!isAuthenticated && t('dashboard.trashGuestNote')}
                    </p>
                  )}
                </div>
                {searchField}
              </div>

              {!isTrashView && !isSearching && !currentFolder && startSection}

              {visibleFolders.length > 0 && (
                <section aria-label={t('folders.title')}>
                  <h2 className="text-base font-semibold text-label mb-3">{t('folders.title')}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleFolders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          itemCount={folderItemCount(folder.id)}
                          onOpen={goToFolder}
                          onRename={(f) => setFolderModal({ mode: 'rename', folder: f })}
                          onDelete={setFolderToDelete}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              )}

              {isSearching && !isTrashView && isSearchingContent && (
                <p className="text-sm text-label-2 flex items-center gap-2" role="status">
                  <Search className="w-4 h-4 animate-pulse" />
                  <span>{t('dashboard.searchingContent')}</span>
                </p>
              )}

              {loading ? (
                <div className={GRID} aria-busy="true">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n}>
                      <div className="aspect-[4/3] rounded-2xl bg-fill animate-pulse" />
                      <div className="mt-3 h-3 w-2/3 rounded-full bg-fill animate-pulse" />
                      <div className="mt-2 h-2.5 w-1/3 rounded-full bg-fill animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : filteredBoards.length > 0 ? (
                <section aria-label={t('dashboard.boardsSection')}>
                  {visibleFolders.length > 0 && (
                    <h2 className="text-base font-semibold text-label mb-3">{t('dashboard.boardsSection')}</h2>
                  )}
                  <div className={GRID}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {filteredBoards.map((b) => (
                        <BoardCard
                          key={b.id}
                          board={b}
                          onOpen={onNavigateToBoard}
                          onRename={handleRename}
                          onDuplicate={handleDuplicate}
                          onDelete={handleMoveToTrash}
                          onThumbnailGenerated={handleThumbnailGenerated}
                          onMove={foldersAvailable && !isTrashView ? setBoardToMove : undefined}
                          snippet={snippetById.get(b.id)}
                          trash={
                            isTrashView
                              ? {
                                  onRestore: handleRestore,
                                  onDeletePermanently:
                                    user?.id && b.owner_id === user.id ? setBoardToPurge : undefined,
                                }
                              : undefined
                          }
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              ) : searchQuery && !(isSearchingContent && !isTrashView) ? (
                <EmptyState
                  icon={Search}
                  title={t('dashboard.noResultsTitle')}
                  body={isTrashView ? t('dashboard.noResultsTrash', { query: searchQuery }) : t('dashboard.noResults', { query: searchQuery })}
                >
                  <Button variant="secondary" onClick={() => setSearchQuery('')}>
                    <X className="w-4 h-4" />
                    <span>{t('dashboard.clearSearch')}</span>
                  </Button>
                </EmptyState>
              ) : isTrashView ? (
                <EmptyState icon={Trash2} title={t('dashboard.trashEmpty')}>
                  <Button variant="secondary" onClick={() => setView('boards')}>
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t('dashboard.backToBoards')}</span>
                  </Button>
                </EmptyState>
              ) : currentFolder && !isSearching && visibleFolders.length === 0 ? (
                <EmptyState icon={FolderIcon} title={t('dashboard.folderEmpty')} body={t('dashboard.folderEmptyHint')}>
                  <Button variant="primary" onClick={() => handleCreateBoard()}>
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                    <span>{t('dashboard.newBoardInFolder')}</span>
                  </Button>
                </EmptyState>
              ) : null}
            </section>
          )}
        </main>

        <footer className="lg:hidden py-6 px-4 sm:px-8 flex items-center justify-between gap-3 text-xs text-label-2">
          <a href={`${STATIC_PAGES.home[locale]}?home`} className="hover:text-label transition-colors">heeey.click</a>
          <div className="flex items-center gap-4">
            {onNavigateToDocs && (
              <button onClick={onNavigateToDocs} className="hover:text-label transition-colors">
                {t('dashboard.documentation')}
              </button>
            )}
            <a
              href="https://github.com/carloseorsantos/heeey.click"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-label transition-colors"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>

      <Toast toast={toast} undoLabel={t('dashboard.undo')} onDismiss={hideToast} />

      <Modal
        isOpen={!!boardToPurge}
        onClose={() => !isPurging && setBoardToPurge(null)}
        title={t('dashboard.purgeTitle')}
        description={t('dashboard.purgeDescription', { title: boardToPurge?.title || untitled })}
        icon={
          <ModalIcon tone="danger">
            <Trash2 />
          </ModalIcon>
        }
        size="sm"
      >
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button onClick={() => setBoardToPurge(null)} disabled={isPurging}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleConfirmPurge} disabled={isPurging}>
            {isPurging ? t('dashboard.deleting') : t('boardCard.deletePermanently')}
          </Button>
        </div>
      </Modal>

      <FolderNameModal
        isOpen={!!folderModal}
        mode={folderModal?.mode ?? 'create'}
        initialName={folderModal?.mode === 'rename' ? folderModal.folder.name : ''}
        onClose={() => setFolderModal(null)}
        onSubmit={(name) =>
          folderModal?.mode === 'rename' ? renameFolder(folderModal.folder.id, name) : handleCreateFolder(name)
        }
      />

      <MoveToFolderModal
        isOpen={!!boardToMove}
        itemName={boardToMove?.title || untitled}
        folders={folders}
        currentFolderId={parentOf(boardToMove?.folder_id)}
        onClose={() => setBoardToMove(null)}
        onMove={handleMoveBoard}
      />

      <Modal
        isOpen={!!folderToDelete}
        onClose={() => !isDeletingFolder && setFolderToDelete(null)}
        title={t('dashboard.deleteFolderTitle')}
        description={t('dashboard.deleteFolderDescription', { name: folderToDelete?.name ?? '' })}
        icon={
          <ModalIcon tone="danger">
            <Trash2 />
          </ModalIcon>
        }
        size="sm"
      >
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button onClick={() => setFolderToDelete(null)} disabled={isDeletingFolder}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleConfirmDeleteFolder} disabled={isDeletingFolder}>
            {isDeletingFolder ? t('dashboard.deleting') : t('folders.delete')}
          </Button>
        </div>
      </Modal>

    </div>
  );
}
