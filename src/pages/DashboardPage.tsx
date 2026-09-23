import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { Board } from '../lib/types';
import { supabase } from '../lib/supabase';
import {
  getLocalBoards,
  saveLocalBoard,
  deleteLocalBoard,
  markBoardAsCreated,
  isBoardLocallyCreated,
} from '../lib/storage';
import {
  generateId,
  getBrainstormingTemplate,
  getFlowchartTemplate,
  getWireframeTemplate,
} from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { BoardCard } from '../components/BoardCard';
import { AuthModal } from '../components/AuthModal';
import { NicknameModal } from '../components/NicknameModal';
import { HeeeyLogo } from '../components/Logo';
import { Avatar } from '../components/Avatar';

interface DashboardPageProps {
  onNavigateToBoard: (boardId: string) => void;
}

const DEFAULT_BOARD_TITLE = 'Quadro sem título';
const UNDO_DELETE_MS = 5000;

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

interface PendingDelete {
  board: Board;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}

export function DashboardPage({ onNavigateToBoard }: DashboardPageProps) {
  const { user, isAuthenticated, signOut, effectiveUserName, guestProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [boards, setBoards] = useState<Board[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNicknameOpen, setIsNicknameOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  pendingDeleteRef.current = pendingDelete;

  // Load boards from Supabase and merge with local boards
  useEffect(() => {
    async function loadBoards() {
      setLoading(true);
      const localList = getLocalBoards();

      try {
        if (user?.id) {
          // Authenticated: load user boards from Supabase
          const { data, error } = await supabase
            .from('boards')
            .select('*')
            .eq('owner_id', user.id)
            .order('updated_at', { ascending: false });

          if (data && !error) {
            const remoteMap = new Map<string, Board>();
            data.forEach((b: any) => remoteMap.set(b.id, b as Board));

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
          saveLocalBoard(updated);
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

  function handleDuplicate(board: Board) {
    const newId = generateId();
    const duplicate: Board = {
      ...board,
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

  const commitDelete = useCallback((id: string) => {
    deleteLocalBoard(id);
    (async () => {
      try {
        const { error } = await supabase.from('boards').delete().eq('id', id);
        if (error) {
          console.warn('Erro ao excluir quadro do Supabase:', error.message);
        }
      } catch (e) {
        console.warn('Exceção ao excluir quadro do Supabase:', e);
      }
    })();
  }, []);

  // Deleting is deferred so the user can undo; flush any pending delete on unmount
  useEffect(() => {
    return () => {
      const pending = pendingDeleteRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        commitDelete(pending.board.id);
      }
    };
  }, [commitDelete]);

  function handleDelete(id: string) {
    const index = boards.findIndex((b) => b.id === id);
    if (index === -1) return;

    // Only one undo slot: finalize the previous deletion right away
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      commitDelete(pendingDelete.board.id);
    }

    const timer = setTimeout(() => {
      commitDelete(id);
      setPendingDelete((current) => (current?.board.id === id ? null : current));
    }, UNDO_DELETE_MS);

    setPendingDelete({ board: boards[index], index, timer });
    setBoards((prev) => prev.filter((b) => b.id !== id));
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    const { board, index } = pendingDelete;
    setBoards((prev) => {
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, board);
      return next;
    });
    setPendingDelete(null);
  }

  const filteredBoards = boards.filter((b) =>
    (b.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  // Keep the list layout while an undo is pending so the page does not jump to the hero
  const isFirstRun = !loading && boards.length === 0 && !pendingDelete;

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
              <h1
                id="boards-heading"
                className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <span>Meus quadros</span>
                {!loading && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                    {boards.length}
                  </span>
                )}
              </h1>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64 sm:flex-none">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Buscar quadros"
                    aria-label="Buscar quadros por título"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  />
                </div>
                <button
                  onClick={() => handleCreateBoard()}
                  className="h-10 flex items-center gap-1.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-sm font-semibold shadow-md shadow-brand-600/20 transition flex-shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Novo quadro</span>
                </button>
              </div>
            </div>

            {!searchQuery && templatesSection}

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
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : searchQuery ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-4">
                  <LayoutGrid className="w-7 h-7" />
                </div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Nenhum quadro encontrado</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1.5">
                  Nenhum título corresponde a “{searchQuery}”.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 text-sm font-semibold transition"
                >
                  <X className="w-4 h-4" />
                  <span>Limpar busca</span>
                </button>
              </div>
            ) : null}
          </section>
        )}
      </main>

      {/* Undo toast */}
      <div aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm">
        {pendingDelete && (
          <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-2 bg-slate-900 text-white rounded-xl shadow-2xl animate-pop-in dark:bg-slate-800 dark:border dark:border-slate-700">
            <span className="text-sm truncate">
              “{pendingDelete.board.title || DEFAULT_BOARD_TITLE}” foi excluído
            </span>
            <button
              onClick={handleUndoDelete}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-brand-300 hover:bg-white/10 transition flex-shrink-0"
            >
              Desfazer
            </button>
          </div>
        )}
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <NicknameModal isOpen={isNicknameOpen} onClose={() => setIsNicknameOpen(false)} />
    </div>
  );
}
