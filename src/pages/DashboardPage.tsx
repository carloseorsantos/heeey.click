import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  LogIn,
  LogOut,
  LayoutGrid,
  Workflow,
  Lightbulb,
  PanelsTopLeft,
  Sun,
  Moon,
  X,
  Trash2,
  ArrowLeft,
  FolderPlus,
  ChevronRight,
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
import { useTheme } from '../hooks/useTheme';
import { BoardCard } from '../components/BoardCard';
import { AuthModal } from '../components/AuthModal';
import { NicknameModal } from '../components/NicknameModal';
import { HeeeyLogo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { FolderCard } from '../components/FolderCard';
import { FolderNameModal } from '../components/FolderNameModal';
import { MoveToFolderModal } from '../components/MoveToFolderModal';
import { useFolders } from '../hooks/useFolders';
import { Folder, getFolderPath, moveBoardToFolder } from '../lib/folders';
import { BoardSearchHit, searchBoardsRemote, searchLoadedBoards } from '../lib/search';

interface DashboardPageProps {
  onNavigateToBoard: (boardId: string) => void;
}

const DEFAULT_BOARD_TITLE = 'Quadro sem título';
const TOAST_MS = 5000;

const TEMPLATES = [
  {
    title: 'Brainstorming',
    boardTitle: 'Sessão de brainstorming',
    description: 'Ideias e post-its',
    Icon: Lightbulb,
    iconClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    hoverClass: 'hover:border-amber-400 dark:hover:border-amber-600',
    getElements: getBrainstormingTemplate,
  },
  {
    title: 'Fluxograma',
    boardTitle: 'Diagrama de fluxo',
    description: 'Processos e conexões',
    Icon: Workflow,
    iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    hoverClass: 'hover:border-emerald-400 dark:hover:border-emerald-600',
    getElements: getFlowchartTemplate,
  },
  {
    title: 'Wireframe',
    boardTitle: 'Wireframe de interface',
    description: 'Layouts e protótipos',
    Icon: PanelsTopLeft,
    iconClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
    hoverClass: 'hover:border-indigo-400 dark:hover:border-indigo-600',
    getElements: getWireframeTemplate,
  },
];

const iconButtonClass =
  'w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition';

interface Toast {
  message: string;
  onUndo?: () => void;
}

export function DashboardPage({ onNavigateToBoard }: DashboardPageProps) {
  const { user, isAuthenticated, signOut, effectiveUserName, guestProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [boards, setBoards] = useState<Board[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNicknameOpen, setIsNicknameOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'boards' | 'trash'>('boards');
  const [toast, setToast] = useState<Toast | null>(null);
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
      title: templateTitle || DEFAULT_BOARD_TITLE,
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
        showToast({ message: 'Não foi possível duplicar o quadro. Tente novamente.' });
        return;
      }
      board = { ...source, ...content };
    }

    const { contentLoaded: _contentLoaded, ...boardData } = board;
    const newId = generateId();
    const duplicate: Board = {
      ...boardData,
      id: newId,
      title: `${board.title} (cópia)`,
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

  function showToast(next: Toast) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS);
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
          ? 'Não foi possível mover o quadro para a lixeira.'
          : 'Não foi possível restaurar o quadro.',
      });
    });
  }

  function handleMoveToTrash(id: string) {
    const board = boards.find((b) => b.id === id);
    if (!board) return;
    setTrashed(id, true);
    showToast({
      message: `“${board.title || DEFAULT_BOARD_TITLE}” foi para a lixeira`,
      onUndo: () => setTrashed(id, false),
    });
  }

  function handleRestore(id: string) {
    const board = boards.find((b) => b.id === id);
    if (!board) return;
    setTrashed(id, false);
    showToast({
      message: `“${board.title || DEFAULT_BOARD_TITLE}” foi restaurado`,
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
      showToast({ message: `“${title || DEFAULT_BOARD_TITLE}” foi excluído definitivamente` });
    } else {
      showToast({ message: 'Não foi possível excluir o quadro. Tente novamente.' });
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
      showToast({ message: 'Não foi possível excluir a pasta. Tente novamente.' });
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
    showToast({ message: `Pasta “${folder.name}” excluída` });
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
    showToast({ message: `Movido para “${target?.name ?? 'Meus quadros'}”` });
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
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
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

  const templatesSection = (
    <section aria-labelledby="templates-heading">
      <h2
        id="templates-heading"
        className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3"
      >
        {isFirstRun ? 'Ou comece com um modelo' : 'Começar com um modelo'}
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {TEMPLATES.map(({ title, boardTitle, description, Icon, iconClass, hoverClass, getElements }) => (
          <button
            key={title}
            onClick={() => handleCreateBoard(boardTitle, getElements())}
            className={`flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-3 rounded-2xl text-center sm:text-left bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition group ${hoverClass}`}
          >
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${iconClass}`}
            >
              <Icon className="w-5 h-5" />
            </span>
            <span className="min-w-0 max-w-full">
              <span className="block text-xs sm:text-sm font-semibold text-slate-900 dark:text-white sm:truncate">{title}</span>
              <span className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <nav className="h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <HeeeyLogo className="w-9 h-9 shadow-md shadow-brand-500/25" />
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              heeey<span className="text-brand-600 dark:text-brand-400">.click</span>
            </p>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Lousa colaborativa ao vivo</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className={iconButtonClass}
            aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsNicknameOpen(true)}
            className="h-10 flex items-center gap-2 pl-1 pr-1 sm:pr-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label={`Editar perfil (${effectiveUserName})`}
            title="Editar nome e cor"
          >
            <Avatar name={effectiveUserName} color={guestProfile.color} className="w-8 h-8" />
            <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
              {effectiveUserName}
            </span>
          </button>

          {isAuthenticated ? (
            <button
              onClick={() => signOut()}
              className={iconButtonClass}
              aria-label="Sair da conta"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="h-10 flex items-center gap-1.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 text-sm font-semibold transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        {isFirstRun ? (
          <>
            {/* Hero: only for people without boards yet */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-700 p-6 sm:p-10 text-white shadow-xl shadow-brand-600/10 mb-8">
              <div className="relative z-10 max-w-2xl">
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Desenhe, crie ideias e colabore em tempo real.
                </h1>
                <p className="text-brand-50 text-base mt-3 max-w-lg">
                  Convide pessoas com um link, veja os cursores ao vivo e tenha tudo salvo na nuvem. Sem
                  cadastro.
                </p>
                <button
                  onClick={() => handleCreateBoard()}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-brand-700 font-bold text-sm shadow-lg hover:bg-brand-50 active:scale-95 transition"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  <span>Criar meu primeiro quadro</span>
                </button>
              </div>
              <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute right-32 top-0 w-48 h-48 rounded-full bg-brand-400/20 blur-xl pointer-events-none" />
            </section>
            {templatesSection}
          </>
        ) : (
          <section aria-labelledby="boards-heading" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 sm:flex-1">
                {(isTrashView || currentFolder) && (
                  <button
                    onClick={() => (isTrashView ? setView('boards') : setCurrentFolderId(currentFolder?.parent_id ?? null))}
                    className="w-9 h-9 -ml-2 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition flex-shrink-0"
                    aria-label={isTrashView ? 'Voltar para meus quadros' : 'Voltar para a pasta anterior'}
                    title={isTrashView ? 'Voltar para meus quadros' : 'Voltar'}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="min-w-0">
                  {!isTrashView && folderPath.length > 0 && (
                    <nav aria-label="Caminho da pasta">
                      <ol className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                        {[{ id: null as string | null, name: 'Meus quadros' }, ...folderPath.slice(0, -1)].map((crumb) => (
                          <li key={crumb.id ?? 'root'} className="flex items-center gap-1 min-w-0">
                            <button
                              onClick={() => setCurrentFolderId(crumb.id)}
                              className="truncate max-w-[10rem] hover:text-brand-700 dark:hover:text-brand-300 hover:underline"
                            >
                              {crumb.name}
                            </button>
                            <ChevronRight className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                          </li>
                        ))}
                      </ol>
                    </nav>
                  )}
                  <h1
                    id="boards-heading"
                    className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 whitespace-nowrap min-w-0"
                  >
                    <span className="truncate">
                      {isTrashView ? 'Lixeira' : currentFolder?.name ?? 'Meus quadros'}
                    </span>
                    {!loading && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                        {isSearching ? filteredBoards.length : visibleBoards.length}
                      </span>
                    )}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <div className="relative flex-1 min-w-0 sm:w-56 sm:flex-initial">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    placeholder={isTrashView ? 'Buscar na lixeira' : currentFolder ? 'Buscar em todas as pastas' : 'Buscar quadros'}
                    aria-label={isTrashView ? 'Buscar na lixeira por título' : 'Buscar quadros por título ou texto'}
                    aria-keyshortcuts="/"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  />
                </div>
                {!isTrashView && trashedBoards.length > 0 && (
                  <button
                    onClick={() => {
                      setView('trash');
                      setSearchQuery('');
                    }}
                    className={`${iconButtonClass} relative flex-shrink-0`}
                    aria-label={`Abrir lixeira (${trashedBoards.length})`}
                    title="Lixeira"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900 text-[11px] font-bold flex items-center justify-center">
                      {trashedBoards.length}
                    </span>
                  </button>
                )}
                {showFolders && (
                  <button
                    onClick={() => setFolderModal({ mode: 'create' })}
                    className={`${iconButtonClass} flex-shrink-0`}
                    aria-label="Nova pasta"
                    title="Nova pasta"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                )}
                {!isTrashView && (
                  <button
                    onClick={() => handleCreateBoard()}
                    aria-label="Novo quadro"
                    className="h-10 flex items-center gap-1.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-sm font-semibold shadow-md shadow-brand-600/20 transition flex-shrink-0"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span className="inline sm:hidden md:inline">Novo quadro</span>
                  </button>
                )}
              </div>
            </div>

            {isTrashView ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Quadros na lixeira ficam somente leitura. Restaure um quadro para voltar a editá-lo.
                {!isAuthenticated && ' Entre na sua conta para excluir quadros definitivamente.'}
              </p>
            ) : (
              !isSearching && !currentFolder && templatesSection
            )}

            {visibleFolders.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    itemCount={folderItemCount(folder.id)}
                    onOpen={setCurrentFolderId}
                    onRename={(f) => setFolderModal({ mode: 'rename', folder: f })}
                    onDelete={setFolderToDelete}
                  />
                ))}
              </div>
            )}

            {isSearching && !isTrashView && isSearchingContent && (
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2" role="status">
                <Search className="w-4 h-4 animate-pulse" />
                <span>Buscando também no conteúdo dos quadros…</span>
              </p>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-busy="true">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-52 rounded-2xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
                ))}
              </div>
            ) : filteredBoards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
              </div>
            ) : searchQuery && !(isSearchingContent && !isTrashView) ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-4">
                  <LayoutGrid className="w-7 h-7" />
                </div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Nenhum quadro encontrado</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1.5">
                  Nada corresponde a “{searchQuery}”{isTrashView ? ' na lixeira' : ' nos títulos nem no conteúdo dos quadros'}.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 text-sm font-semibold transition"
                >
                  <X className="w-4 h-4" />
                  <span>Limpar busca</span>
                </button>
              </div>
            ) : isTrashView ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7" />
                </div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">A lixeira está vazia</h2>
                <button
                  onClick={() => setView('boards')}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 text-sm font-semibold transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para meus quadros</span>
                </button>
              </div>
            ) : currentFolder && !isSearching && visibleFolders.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Esta pasta está vazia</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1.5">
                  Crie um quadro aqui ou mova quadros existentes pelo menu de cada um.
                </p>
                <button
                  onClick={() => handleCreateBoard()}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-md shadow-brand-600/20 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo quadro nesta pasta</span>
                </button>
              </div>
            ) : null}
          </section>
        )}
      </main>

      {/* Toast (with optional undo) */}
      <div aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm">
        {toast && (
          <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-2 min-h-[3.25rem] bg-slate-900 text-white rounded-xl shadow-2xl animate-pop-in dark:bg-slate-800 dark:border dark:border-slate-700">
            <span className="text-sm truncate">{toast.message}</span>
            {toast.onUndo && (
              <button
                onClick={() => {
                  toast.onUndo?.();
                  setToast(null);
                }}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-brand-300 hover:bg-white/10 transition flex-shrink-0"
              >
                Desfazer
              </button>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!boardToPurge}
        onClose={() => !isPurging && setBoardToPurge(null)}
        title="Excluir definitivamente?"
        description={`“${boardToPurge?.title || DEFAULT_BOARD_TITLE}” e as imagens dele serão apagados para sempre. Essa ação não pode ser desfeita.`}
        icon={
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
        }
        size="sm"
      >
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setBoardToPurge(null)}
            disabled={isPurging}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmPurge}
            disabled={isPurging}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition disabled:opacity-60"
          >
            {isPurging ? 'Excluindo…' : 'Excluir definitivamente'}
          </button>
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
        itemName={boardToMove?.title || DEFAULT_BOARD_TITLE}
        folders={folders}
        currentFolderId={parentOf(boardToMove?.folder_id)}
        onClose={() => setBoardToMove(null)}
        onMove={handleMoveBoard}
      />

      <Modal
        isOpen={!!folderToDelete}
        onClose={() => !isDeletingFolder && setFolderToDelete(null)}
        title="Excluir pasta?"
        description={`A pasta “${folderToDelete?.name ?? ''}” e as subpastas dela serão excluídas. Os quadros de dentro voltam para Meus quadros.`}
        icon={
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
        }
        size="sm"
      >
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setFolderToDelete(null)}
            disabled={isDeletingFolder}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmDeleteFolder}
            disabled={isDeletingFolder}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition disabled:opacity-60"
          >
            {isDeletingFolder ? 'Excluindo…' : 'Excluir pasta'}
          </button>
        </div>
      </Modal>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <NicknameModal isOpen={isNicknameOpen} onClose={() => setIsNicknameOpen(false)} />
    </div>
  );
}
