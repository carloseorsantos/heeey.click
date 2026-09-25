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
  FolderKanban,
  Lock,
  UsersRound,
  Settings2,
  Inbox,
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
  getClaimableLocalBoards,
} from '../lib/storage';
import {
  fetchBoardSummaries,
  fetchBoardContent,
  saveBoardThumbnail,
  fetchTeamBoards,
  fetchSharedBoards,
} from '../lib/boardQueries';
import { moveBoard, toBoardInsert } from '../lib/sharing';
import { Project, Team, canEditProject, canManageProject, canManageTeam } from '../lib/teams';
import { useTeams } from '../hooks/useTeams';
import { useProjectName } from '../hooks/useProjectName';
import { TeamSwitcher } from '../components/TeamSwitcher';
import { CreateTeamModal } from '../components/CreateTeamModal';
import { ProjectModal } from '../components/ProjectModal';
import { MoveToProjectModal } from '../components/MoveToProjectModal';
import { BOARDS_CLAIMED_EVENT, OPEN_CLAIM_EVENT } from '../components/ClaimBoardsDialog';
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
  /** Client-side navigation (replace: no new history entry) */
  onNavigate?: (path: string, options?: { replace?: boolean }) => void;
  /** /t/:slug and /t/:slug/p/:projectId */
  teamSlug?: string | null;
  projectId?: string | null;
  /** /shared: boards shared directly with me */
  section?: 'shared' | null;
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
  action,
}: {
  icon: typeof Trash2;
  label: string;
  selected?: boolean;
  depth?: number;
  badge?: number;
  onClick: () => void;
  /** Trailing button revealed on hover (e.g. project settings) */
  action?: { icon: typeof Trash2; label: string; onClick: () => void };
}) {
  return (
    <div className="group/item relative">
      <button
        type="button"
        onClick={onClick}
        aria-current={selected ? 'page' : undefined}
        style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
        className={cn(
          'w-full h-8 flex items-center gap-2 pr-2 rounded-lg text-sm text-left transition-colors duration-100',
          selected ? 'bg-fill-2 text-label font-medium' : 'text-label hover:bg-fill',
          action && 'pr-8'
        )}
      >
        <Icon className={cn('w-4 h-4 flex-shrink-0', selected ? 'text-accent-text' : 'text-label-2')} />
        <span className="flex-1 truncate">{label}</span>
        {!!badge && <span className={cn('text-xs text-label-2 tabular-nums', action && '[@media(hover:hover)]:group-hover/item:opacity-0')}>{badge}</span>}
      </button>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          aria-label={action.label}
          title={action.label}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-label-2 hover:text-label hover:bg-fill-2 [@media(hover:hover)]:opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100"
        >
          <action.icon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function DashboardPage({
  onNavigateToBoard,
  onNavigateToDocs,
  onNavigate,
  teamSlug = null,
  projectId = null,
  section = null,
}: DashboardPageProps) {
  const { user, isAuthenticated, guestProfile } = useAuth();
  const { t, locale } = useI18n();
  const projectName = useProjectName();
  const untitled = t('board.untitled');
  const {
    teams,
    available: teamsAvailable,
    loading: teamsLoading,
    activeTeam,
    setActiveTeamId,
    refreshTeams,
    projects: activeProjects,
    refreshProjects,
  } = useTeams();

  useEffect(() => {
    document.title = t('app.documentTitle');
  }, [t]);

  // Teams: signed in and the database has them. Otherwise the dashboard works as before
  // (guests: boards of this browser; old databases: boards the user created)
  const usesTeams = isAuthenticated && teamsAvailable;
  const urlTeam = teamSlug ? teams.find((candidate) => candidate.slug === teamSlug) ?? null : null;
  const team: Team | null = usesTeams ? urlTeam ?? activeTeam : null;
  const projects = activeProjects.filter((p) => p.team_id === team?.id);
  const project = projectId ? projects.find((p) => p.id === projectId) ?? null : null;
  const defaultProject = projects.find((p) => p.is_default) ?? null;
  const go = (path: string, replace = false) => onNavigate?.(path, { replace });

  // The team in the URL becomes the active one (Settings › Team, next visit to /app)
  useEffect(() => {
    if (urlTeam && urlTeam.id !== activeTeam?.id) setActiveTeamId(urlTeam.id);
  }, [urlTeam?.id]);

  // Unknown team or project in the URL (left the team, deleted project): back to the team
  useEffect(() => {
    if (!usesTeams || teamsLoading || !activeTeam) return;
    if (teamSlug && !urlTeam) go(`/t/${activeTeam.slug}`, true);
    else if (projectId && team && projects.length > 0 && !project) go(`/t/${team.slug}`, true);
  }, [usesTeams, teamsLoading, teamSlug, urlTeam?.id, projectId, project?.id, projects.length]);

  const [boards, setBoards] = useState<Board[]>([]);
  const [sharedRoles, setSharedRoles] = useState<Map<string, 'edit' | 'view'>>(new Map());
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { openSettings, openAuthDialog } = useSettings();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'boards' | 'trash'>('boards');
  const isSharedView = usesTeams && section === 'shared';
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastIdRef = useRef(0);
  const [boardToPurge, setBoardToPurge] = useState<Board | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Folders live in a project; the all-boards view of a team shows no folders
  const {
    folders,
    available: foldersAvailable,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useFolders(user?.id, usesTeams ? project?.id : null, !usesTeams || (!!project && !isSharedView));
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderModal, setFolderModal] = useState<{ mode: 'create' } | { mode: 'rename'; folder: Folder } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [boardToMove, setBoardToMove] = useState<Board | null>(null);
  const [boardToMoveProject, setBoardToMoveProject] = useState<Board | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [projectModal, setProjectModal] = useState<{ projectId: string | null } | null>(null);
  const [claimableCount, setClaimableCount] = useState(0);
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

  // Changing team, project or section starts at the top, outside any folder
  useEffect(() => {
    setCurrentFolderId(null);
    setView('boards');
    setSearchQuery('');
    scrollRef.current?.scrollTo({ top: 0 });
  }, [team?.id, project?.id, section]);

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
      const hits = await searchBoardsRemote(query, 20, usesTeams && !isSharedView ? team?.id : null);
      if (cancelled) return;
      setRemoteHits(hits);
      setIsSearchingContent(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, user?.id, view, team?.id, isSharedView]);

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

  // Boards created before signing in wait in this browser until claimed into a team
  useEffect(() => {
    const count = () => setClaimableCount(usesTeams ? getClaimableLocalBoards(guestProfile.id).length : 0);
    count();
    const handleClaimed = () => {
      count();
      setReloadKey((k) => k + 1);
    };
    window.addEventListener(BOARDS_CLAIMED_EVENT, handleClaimed);
    return () => window.removeEventListener(BOARDS_CLAIMED_EVENT, handleClaimed);
  }, [usesTeams, guestProfile.id]);

  // Load boards from Supabase and merge with local boards
  useEffect(() => {
    let cancelled = false;
    async function loadBoards() {
      setLoading(true);
      const localList = getLocalBoards();

      try {
        if (user?.id && usesTeams) {
          if (isSharedView) {
            const shared = await fetchSharedBoards(user.id);
            if (cancelled) return;
            setSharedRoles(new Map((shared || []).map((s) => [s.board.id, s.role])));
            setBoards((shared || []).map((s) => s.board));
            setLoading(false);
            return;
          }
          if (!team) return;
          const data = await fetchTeamBoards(team.id);
          if (cancelled) return;
          if (data) {
            const remoteIds = new Set(data.map((b) => b.id));
            // Boards of this team saved only locally so far (e.g. created offline)
            const pending = localList.filter((local) => local.team_id === team.id && !remoteIds.has(local.id));
            setBoards(
              [...data, ...pending].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            );
            setLoading(false);
            return;
          }
        } else if (user?.id) {
          // Authenticated: load light summaries (no scene data) of the user's boards
          const data = await fetchBoardSummaries(user.id);
          if (cancelled) return;

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
      if (cancelled) return;

      const fallback = localList.filter(
        (b) =>
          (team ? b.team_id === team.id : user?.id && b.owner_id === user.id) ||
          (!b.owner_id && !usesTeams && isBoardLocallyCreated(b.id, guestProfile.id))
      );
      setBoards(fallback);
      setLoading(false);
    }

    // Signed in: wait for the teams before deciding what to show
    if (user?.id && teamsLoading) return;
    loadBoards();
    return () => {
      cancelled = true;
    };
  }, [user?.id, guestProfile.id, usesTeams, teamsLoading, team?.id, isSharedView, reloadKey]);

  // What the user can do: through the project (teams) or as its creator (no teams)
  const accessOf = (board: Board): 'manage' | 'edit' | 'view' | null => {
    if (!usesTeams) return !board.owner_id || board.owner_id === user?.id ? 'manage' : 'view';
    if (isSharedView) return sharedRoles.get(board.id) ?? 'view';
    const boardProject = projects.find((p) => p.id === board.project_id);
    if (!boardProject?.my_access) return null;
    if (boardProject.my_access === 'edit' && board.owner_id === user?.id) return 'manage';
    return boardProject.my_access;
  };
  const canEditBoard = (board: Board) => {
    const access = accessOf(board);
    return access === 'manage' || access === 'edit';
  };
  // New boards: the project being viewed, else the team's default project
  const targetProject: Project | null = usesTeams ? project ?? defaultProject : null;
  const canCreate = !usesTeams || (!isSharedView && canEditProject(targetProject));

  async function handleCreateBoard(templateTitle?: string, initialElements?: any[]) {
    if (!canCreate) return;
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
      // New team boards are restricted: only the team/project and invited people open them
      access_level: usesTeams ? 'restricted' : 'edit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(targetProject ? { team_id: targetProject.team_id, project_id: targetProject.id } : {}),
      // New boards land in the folder being viewed
      ...(activeFolderId ? { folder_id: activeFolderId } : {}),
    };

    markBoardAsCreated(newId);
    saveLocalBoard(newBoard);
    setBoards((prev) => [newBoard, ...prev]);

    // Saved before opening, so the board page finds it in its project
    try {
      const { error } = await supabase.from('boards').insert(toBoardInsert(newBoard));
      if (error) console.warn('Erro ao criar quadro no Supabase:', error.message);
    } catch (e) {
      // Offline: the board page saves it later
    }

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

    // The copy stays in the same project when possible, and starts restricted like any new board
    const sourceProject = projects.find((p) => p.id === board.project_id);
    const copyProject = usesTeams ? (canEditProject(sourceProject) ? sourceProject! : targetProject) : null;
    if (usesTeams && !canEditProject(copyProject)) {
      showToast({ message: t('dashboard.duplicateError') });
      return;
    }
    const newId = generateId();
    const duplicate: Board = {
      id: newId,
      title: t('dashboard.copySuffix', { title: board.title }),
      owner_id: user?.id || null,
      elements: board.elements,
      app_state: board.app_state,
      files: board.files,
      thumbnail: board.thumbnail,
      access_level: usesTeams ? 'restricted' : board.access_level,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(copyProject ? { team_id: copyProject.team_id, project_id: copyProject.id } : {}),
      ...(board.folder_id && copyProject?.id === board.project_id ? { folder_id: board.folder_id } : {}),
    };

    markBoardAsCreated(newId);
    saveLocalBoard(duplicate);
    if (!isSharedView) setBoards((prev) => [duplicate, ...prev]);

    (async () => {
      try {
        await supabase.from('boards').insert(toBoardInsert(duplicate));
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
    // Only people who edit the board may store its preview
    const board = boards.find((b) => b.id === id);
    if (!board || canEditBoard(board)) saveBoardThumbnail(id, thumbnail);
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
    showToast({ message: t('dashboard.movedTo', { name: target?.name ?? rootName }) });
    return true;
  }

  /** Returns an error message, or null when moved */
  async function handleMoveToProject(destination: Project): Promise<string | null> {
    if (!boardToMoveProject) return t('projects.moveError');
    const { id } = boardToMoveProject;
    try {
      await moveBoard(id, destination.id);
    } catch (err) {
      return /owner ou admin/.test((err as Error).message) ? t('projects.moveNeedsAdmin') : t('projects.moveError');
    }
    updateLocalBoardMeta(id, { folder_id: null });
    setBoards((prev) =>
      destination.team_id === team?.id
        ? prev.map((b) => (b.id === id ? { ...b, project_id: destination.id, folder_id: null } : b))
        : prev.filter((b) => b.id !== id)
    );
    showToast({ message: t('dashboard.movedTo', { name: projectName(destination) }) });
    return null;
  }

  // Scope of the boards view: a project, the whole team, shared with me, or (no teams) everything
  const scopedBoards = usesTeams && project && !isSharedView ? boards.filter((b) => b.project_id === project.id) : boards;
  const activeBoards = scopedBoards.filter((b) => !b.deleted_at);
  const trashedBoards = scopedBoards.filter((b) => !!b.deleted_at);
  const isTrashView = view === 'trash';

  // Folders: a board or folder pointing to an unknown folder is shown at the root
  const folderIds = new Set(folders.map((f) => f.id));
  const parentOf = (id: string | null | undefined) => (id && folderIds.has(id) ? id : null);
  const activeFolderId = foldersAvailable ? parentOf(currentFolderId) : null;
  const currentFolder = folders.find((f) => f.id === activeFolderId) ?? null;
  const folderPath = getFolderPath(folders, activeFolderId);
  const isSearching = searchQuery.trim().length > 0;
  const canEditFolders = !usesTeams || canEditProject(project);
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
  const isFirstRun =
    !loading && !isSharedView && !project && boards.length === 0 && folders.length === 0 && (!usesTeams || projects.length <= 1);

  // Name of the place being viewed, at the root of the folder tree
  const rootName = isSharedView
    ? t('dashboard.sharedWithMe')
    : project
      ? projectName(project)
      : usesTeams
        ? t('dashboard.allBoards')
        : t('dashboard.myBoards');
  const pageTitle = isTrashView ? t('dashboard.trash') : currentFolder?.name ?? rootName;
  // iOS-style back button names the place it goes back to
  const backTarget = isTrashView
    ? { label: rootName, aria: t('dashboard.backToBoards'), go: () => setView('boards') }
    : currentFolder
      ? {
          label: folders.find((f) => f.id === parentOf(currentFolder.parent_id))?.name ?? rootName,
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

  function goToTeamRoot() {
    if (usesTeams && team && (project || isSharedView)) go(`/t/${team.slug}`);
    else goToFolder(null);
  }

  function goToProject(target: Project) {
    if (!team) return;
    if (target.id === project?.id) goToFolder(null);
    else go(`/t/${team.slug}/p/${target.id}`);
  }

  function selectTeam(next: Team) {
    setActiveTeamId(next.id);
    go(`/t/${next.slug}`);
  }

  function openTrash() {
    if (isSharedView && team) go(`/t/${team.slug}`);
    setView('trash');
    setSearchQuery('');
    scrollRef.current?.scrollTo({ top: 0 });
  }

  const editingProject = projectModal?.projectId ? projects.find((p) => p.id === projectModal.projectId) ?? null : null;
  const canCreateProject = !!team && team.my_role !== 'viewer';

  const startSection = canCreate && (
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

        {usesTeams && team && (
          <div className="px-2 pb-2 flex-shrink-0">
            <TeamSwitcher
              teams={teams}
              activeTeam={team}
              onSelect={selectTeam}
              onCreate={() => setIsCreateTeamOpen(true)}
              onOpenSettings={() => openSettings('team')}
            />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5" aria-label={t('dashboard.navigation')}>
          <div className="space-y-0.5">
            <SidebarItem
              icon={LayoutGrid}
              label={usesTeams ? t('dashboard.allBoards') : t('dashboard.myBoards')}
              selected={!isTrashView && !activeFolderId && !project && !isSharedView}
              badge={usesTeams ? boards.filter((b) => !b.deleted_at && !isSharedView).length || undefined : activeBoards.length}
              onClick={goToTeamRoot}
            />
            {usesTeams && (
              <SidebarItem
                icon={UsersRound}
                label={t('dashboard.sharedWithMe')}
                selected={isSharedView}
                onClick={() => go('/shared')}
              />
            )}
          </div>

          {usesTeams && team && (
            <div>
              <div className="flex items-center justify-between pl-2 pr-0.5 mb-1">
                <span className="section-label">{t('projects.title')}</span>
                {canCreateProject && (
                  <button
                    type="button"
                    onClick={() => setProjectModal({ projectId: null })}
                    className="pressable w-6 h-6 flex items-center justify-center rounded-md text-label-2 hover:text-label hover:bg-fill"
                    aria-label={t('projects.new')}
                    title={t('projects.new')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {projects.map((p) => (
                  <div key={p.id}>
                    <SidebarItem
                      icon={p.visibility === 'private' ? Lock : FolderKanban}
                      label={projectName(p)}
                      selected={!isTrashView && project?.id === p.id && !activeFolderId}
                      onClick={() => goToProject(p)}
                      action={{ icon: Settings2, label: t('projects.settingsOf', { name: projectName(p) }), onClick: () => setProjectModal({ projectId: p.id }) }}
                    />
                    {/* Folders of the open project, nested under it */}
                    {project?.id === p.id &&
                      foldersAvailable &&
                      folderTree.map(({ folder, depth }) => (
                        <SidebarItem
                          key={folder.id}
                          icon={FolderIcon}
                          label={folder.name}
                          depth={depth + 1}
                          selected={!isTrashView && activeFolderId === folder.id}
                          onClick={() => goToFolder(folder.id)}
                        />
                      ))}
                    {project?.id === p.id && foldersAvailable && canEditFolders && (
                      <button
                        type="button"
                        onClick={() => setFolderModal({ mode: 'create' })}
                        style={{ paddingLeft: '1.375rem' }}
                        className="w-full h-7 flex items-center gap-2 rounded-lg text-xs text-label-2 hover:text-label hover:bg-fill"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>{t('folders.new')}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!usesTeams && foldersAvailable && (
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
            ) : usesTeams && team ? (
              <div className="lg:hidden min-w-0">
                <TeamSwitcher
                  compact
                  teams={teams}
                  activeTeam={team}
                  onSelect={selectTeam}
                  onCreate={() => setIsCreateTeamOpen(true)}
                  onOpenSettings={() => openSettings('team')}
                />
              </div>
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
            {showFolders && canEditFolders && (
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
            {!isTrashView && canCreate && (
              <Button variant="primary" size="md" onClick={() => handleCreateBoard()} aria-label={t('dashboard.newBoard')} className="px-3 sm:px-4">
                <Plus className="w-4 h-4" strokeWidth={2.75} />
                <span className="hidden sm:inline">{t('dashboard.newBoard')}</span>
              </Button>
            )}
            {!isAuthenticated && (
              <Button variant="secondary" onClick={() => openAuthDialog('login')} className="hidden sm:inline-flex">
                <LogIn className="w-4 h-4" />
                <span>{t('dashboard.signIn')}</span>
              </Button>
            )}
            <AccountMenu onOpenDocs={onNavigateToDocs} />
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 pt-2 pb-16">
          {usesTeams && team && (
            <nav
              aria-label={t('projects.title')}
              className="lg:hidden flex gap-2 overflow-x-auto -mx-4 px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {[
                { key: 'all', label: t('dashboard.allBoards'), icon: LayoutGrid, selected: !project && !isSharedView, onClick: goToTeamRoot },
                ...projects.map((p) => ({
                  key: p.id,
                  label: projectName(p),
                  icon: p.visibility === 'private' ? Lock : FolderKanban,
                  selected: project?.id === p.id,
                  onClick: () => goToProject(p),
                })),
                { key: 'shared', label: t('dashboard.sharedWithMe'), icon: UsersRound, selected: isSharedView, onClick: () => go('/shared') },
              ].map(({ key, label, icon: Icon, selected, onClick }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'pressable flex-shrink-0 h-8 px-3 flex items-center gap-1.5 rounded-full text-sm transition-colors',
                    selected ? 'bg-accent text-white' : 'bg-fill text-label'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="max-w-[10rem] truncate">{label}</span>
                </button>
              ))}
              {canCreateProject && (
                <button
                  type="button"
                  onClick={() => setProjectModal({ projectId: null })}
                  className="pressable flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-fill text-label-2"
                  aria-label={t('projects.new')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </nav>
          )}

          {claimableCount > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-fill px-4 py-3" role="status">
              <Inbox className="w-5 h-5 text-accent-text flex-shrink-0" />
              <p className="flex-1 text-sm text-label">{t('claim.banner', { count: claimableCount })}</p>
              <Button size="sm" variant="tinted" onClick={() => window.dispatchEvent(new Event(OPEN_CLAIM_EVENT))}>
                {t('claim.bannerAction')}
              </Button>
            </div>
          )}

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
                        {[{ id: null as string | null, name: rootName }, ...folderPath.slice(0, -1)].map((crumb) => (
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
                  {!isTrashView && usesTeams && team && !currentFolder && (
                    <p className="mt-1 text-sm text-label-2 flex items-center gap-1.5">
                      {isSharedView ? (
                        t('dashboard.sharedWithMeHint')
                      ) : (
                        <>
                          {project?.visibility === 'private' && <Lock className="w-3.5 h-3.5" />}
                          <span className="truncate">
                            {project
                              ? project.visibility === 'private'
                                ? t('projects.privateIn', { team: team.name })
                                : t('projects.openIn', { team: team.name })
                              : team.name}
                          </span>
                          {project && project.my_access === 'view' && <span>· {t('projects.readOnly')}</span>}
                        </>
                      )}
                    </p>
                  )}
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
                          onRename={canEditFolders ? (f) => setFolderModal({ mode: 'rename', folder: f }) : undefined}
                          onDelete={canEditFolders ? setFolderToDelete : undefined}
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
                          onDuplicate={canCreate || (isSharedView && !!targetProject) ? handleDuplicate : undefined}
                          onDelete={handleMoveToTrash}
                          onThumbnailGenerated={handleThumbnailGenerated}
                          onMove={foldersAvailable && !isTrashView ? setBoardToMove : undefined}
                          onMoveToProject={usesTeams && !isSharedView && team && canEditBoard(b) ? setBoardToMoveProject : undefined}
                          // Shared boards are opened and edited on the board itself; they are not ours to move or trash
                          readOnly={!canEditBoard(b) || isSharedView}
                          snippet={snippetById.get(b.id)}
                          trash={
                            isTrashView
                              ? {
                                  onRestore: !usesTeams || canEditBoard(b) ? handleRestore : undefined,
                                  onDeletePermanently:
                                    user?.id && (usesTeams ? accessOf(b) === 'manage' || canManageTeam(team) : b.owner_id === user.id)
                                      ? setBoardToPurge
                                      : undefined,
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
                  {canCreate && (
                    <Button variant="primary" onClick={() => handleCreateBoard()}>
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                      <span>{t('dashboard.newBoardInFolder')}</span>
                    </Button>
                  )}
                </EmptyState>
              ) : isSharedView ? (
                <EmptyState icon={UsersRound} title={t('dashboard.sharedEmpty')} body={t('dashboard.sharedEmptyHint')} />
              ) : project && !isSearching && visibleFolders.length === 0 ? (
                <EmptyState icon={project.visibility === 'private' ? Lock : FolderKanban} title={t('projects.empty')} body={canCreate ? t('projects.emptyHint') : undefined} />
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

      {usesTeams && team && (
        <>
          <MoveToProjectModal
            isOpen={!!boardToMoveProject}
            itemName={boardToMoveProject?.title || untitled}
            teams={teams}
            team={team}
            currentProjectId={boardToMoveProject?.project_id ?? null}
            onClose={() => setBoardToMoveProject(null)}
            onMove={handleMoveToProject}
          />
          <ProjectModal
            isOpen={!!projectModal}
            team={team}
            project={editingProject}
            userId={user?.id}
            onClose={() => setProjectModal(null)}
            onSaved={(saved) => {
              refreshProjects();
              if (!projectModal?.projectId) go(`/t/${team.slug}/p/${saved.id}`);
              else setProjectModal({ projectId: saved.id });
            }}
            onDeleted={(deletedId) => {
              refreshProjects();
              if (project?.id === deletedId) go(`/t/${team.slug}`);
            }}
          />
        </>
      )}

      <CreateTeamModal
        isOpen={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        onCreated={async (created) => {
          await refreshTeams();
          selectTeam(created);
        }}
      />

      <MoveToFolderModal
        isOpen={!!boardToMove}
        itemName={boardToMove?.title || untitled}
        rootName={rootName}
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
