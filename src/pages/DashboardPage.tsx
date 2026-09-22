import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  LogIn,
  LogOut,
  Sparkles,
  LayoutGrid,
  FileSpreadsheet,
  Workflow,
  Lightbulb,
  Sun,
  Moon,
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
import { BoardCard } from '../components/BoardCard';
import { AuthModal } from '../components/AuthModal';
import { NicknameModal } from '../components/NicknameModal';
import { HeeeyLogo } from '../components/Logo';

interface DashboardPageProps {
  onNavigateToBoard: (boardId: string) => void;
}

export function DashboardPage({ onNavigateToBoard }: DashboardPageProps) {
  const { user, isAuthenticated, signOut, effectiveUserName, guestProfile } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNicknameOpen, setIsNicknameOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('heeey_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('heeey_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('heeey_theme', 'light');
    }
  };

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
      title: templateTitle || 'Quadro sem título',
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
      title: `${board.title} (Cópia)`,
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

  function handleDelete(id: string) {
    if (confirm('Tem certeza de que deseja excluir este quadro?')) {
      deleteLocalBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
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
    }
  }

  const filteredBoards = boards.filter((b) =>
    (b.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <nav className="h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <HeeeyLogo className="w-9 h-9 shadow-md shadow-violet-500/25" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              heeey<span className="text-violet-600">.click</span>
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Lousa Interativa & Multiplayer</p>
          </div>
        </div>

        {/* Right side: Theme toggle + auth & profile */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
            title={isDarkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => setIsNicknameOpen(true)}
                className="hidden sm:flex items-center space-x-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-violet-600 transition"
              >
                <span>Olá, <strong>{effectiveUserName}</strong></span>
              </button>
              <button
                onClick={() => signOut()}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                title="Sair da conta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar com Magic Link</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        {/* Banner / Call to Action */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 p-6 sm:p-10 text-white shadow-xl shadow-violet-600/10 mb-10">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-white mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quadro Branco Colaborativo ao Vivo</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Desenhe, crie ideias e colabore em tempo real.
            </h2>
            <p className="text-violet-100 text-sm sm:text-base mt-2 max-w-lg">
              Sem barreiras: convide colegas com um link, acompanhe cursores ao vivo e salve seus diagramas na nuvem.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => handleCreateBoard()}
                className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white text-violet-700 font-bold text-sm shadow-lg hover:bg-violet-50 active:scale-95 transition"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>Criar Novo Quadro</span>
              </button>
            </div>
          </div>
          {/* Subtle background circles */}
          <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute right-32 top-0 w-48 h-48 rounded-full bg-purple-400/20 blur-xl pointer-events-none" />
        </div>

        {/* Templates Quick Bar */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Comece rápido com um modelo
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => handleCreateBoard('Quadro em Branco')}
              className="flex items-center space-x-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-600 shadow-sm transition text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">Em Branco</p>
                <p className="text-[10px] text-slate-400">Canvas limpo</p>
              </div>
            </button>

            <button
              onClick={() => handleCreateBoard('Sessão de Brainstorming', getBrainstormingTemplate())}
              className="flex items-center space-x-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 shadow-sm transition text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">Brainstorming</p>
                <p className="text-[10px] text-slate-400">Ideias & post-its</p>
              </div>
            </button>

            <button
              onClick={() => handleCreateBoard('Diagrama de Fluxo', getFlowchartTemplate())}
              className="flex items-center space-x-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 shadow-sm transition text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Workflow className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">Fluxograma</p>
                <p className="text-[10px] text-slate-400">Processos & conexões</p>
              </div>
            </button>

            <button
              onClick={() => handleCreateBoard('Wireframe de Interface', getWireframeTemplate())}
              className="flex items-center space-x-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-sm transition text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">Wireframe</p>

                <p className="text-[10px] text-slate-400">Layouts e protótipos</p>
              </div>
            </button>
          </div>
        </div>

        {/* Boards Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <LayoutGrid className="w-5 h-5 text-violet-600" />
                <span>Meus Quadros</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  {filteredBoards.length}
                </span>
              </h2>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar quadros por título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>
          </div>

          {/* Grid of Boards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-48 rounded-2xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : filteredBoards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
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
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center my-6">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-4">
                <LayoutGrid className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {searchQuery ? 'Nenhum quadro encontrado' : 'Nenhum quadro criado ainda'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto mt-1.5">
                {searchQuery
                  ? `Não encontramos quadros correspondentes a "${searchQuery}". Tente outro termo.`
                  : 'Crie seu primeiro quadro branco agora mesmo e comece a desenhar instantaneamente.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => handleCreateBoard()}
                  className="mt-5 inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Primeiro Quadro</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <NicknameModal isOpen={isNicknameOpen} onClose={() => setIsNicknameOpen(false)} />
    </div>
  );
}
