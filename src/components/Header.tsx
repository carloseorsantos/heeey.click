import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  CloudCheck,
  CloudOff,
  AlertCircle,
  Loader2,
  Share2,
  LogIn,
  LogOut,
  Eye,
  Edit2,
  UserPen,
  Image,
  FileCode,
  Sun,
  Moon,
} from 'lucide-react';
import { CollaboratorUser, SyncStatus, AccessLevel } from '../lib/types';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useDismiss } from '../hooks/useDismiss';
import { HeeeyLogo } from './Logo';
import { Avatar } from './Avatar';

interface HeaderProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  syncStatus: SyncStatus;
  accessLevel: AccessLevel;
  isViewMode: boolean;
  onlineCollaborators: CollaboratorUser[];
  onOpenShare: () => void;
  onOpenAuth: () => void;
  onOpenNickname: () => void;
  onBackToDashboard: () => void;
  onExport?: (format: 'png' | 'svg') => void;
}

const MAX_VISIBLE_AVATARS = 4;

const menuItemClass =
  'w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800 flex items-center gap-2.5';

function SyncIndicator({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'saving':
      return (
        <span className="flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-300" role="status">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="hidden md:inline">Salvando…</span>
          <span className="sr-only md:hidden">Salvando</span>
        </span>
      );
    case 'saved':
      return (
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" role="status" title="Todas as alterações foram salvas">
          <CloudCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden md:inline">Salvo</span>
          <span className="sr-only md:hidden">Salvo</span>
        </span>
      );
    case 'offline':
      return (
        <span
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          role="status"
          title="Você está offline. As alterações estão seguras no navegador."
        >
          <CloudOff className="w-3.5 h-3.5" />
          <span>Offline</span>
        </span>
      );
    case 'error':
      return (
        <span
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
          role="alert"
          title="Erro ao salvar alterações no servidor"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Erro ao salvar</span>
          <span className="sm:hidden">Erro</span>
        </span>
      );
  }
}

export function Header({
  title,
  onUpdateTitle,
  syncStatus,
  isViewMode,
  onlineCollaborators,
  onOpenShare,
  onOpenAuth,
  onOpenNickname,
  onBackToDashboard,
  onExport,
}: HeaderProps) {
  const { user, isAuthenticated, signOut, effectiveUserName, guestProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [showMenu, setShowMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useDismiss<HTMLDivElement>(showMenu, () => setShowMenu(false));

  useEffect(() => {
    setCurrentTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  function handleTitleSubmit() {
    setIsEditingTitle(false);
    if (!isViewMode && currentTitle.trim() && currentTitle !== title) {
      onUpdateTitle(currentTitle.trim());
    } else {
      setCurrentTitle(title);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setCurrentTitle(title);
      setIsEditingTitle(false);
    }
  }

  function runMenuAction(action: () => void) {
    setShowMenu(false);
    action();
  }

  const displayTitle = title || 'Quadro sem título';
  // The current user is already represented by the profile button on the far right
  const otherCollaborators = onlineCollaborators.filter((c) => !c.isCurrentUser);
  const visibleCollaborators = otherCollaborators.slice(0, MAX_VISIBLE_AVATARS);
  const hiddenCount = otherCollaborators.length - visibleCollaborators.length;

  return (
    <header className="relative h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-2 sm:px-4 flex items-center justify-between gap-2 z-30 select-none dark:bg-slate-900/95 dark:border-slate-800">
      {/* Left: back + brand + title + status */}
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <button
          onClick={onBackToDashboard}
          className="w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
          aria-label="Voltar aos meus quadros"
          title="Voltar aos meus quadros"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          onClick={onBackToDashboard}
          className="hidden lg:flex items-center gap-1.5 rounded-lg pr-1 group flex-shrink-0"
          aria-label="heeey.click — ir para meus quadros"
        >
          <HeeeyLogo className="w-7 h-7 shadow-md shadow-brand-500/25 group-hover:scale-105 transition-transform" />
          <span className="font-bold text-slate-800 text-sm tracking-tight dark:text-white">
            heeey<span className="text-brand-600 dark:text-brand-400">.click</span>
          </span>
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block mx-1" />

        <div className="min-w-0 max-w-[40vw] sm:max-w-xs md:max-w-sm">
          {!isViewMode && isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
              aria-label="Título do quadro"
              className="px-2 py-1.5 text-sm font-semibold bg-brand-50 border border-brand-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white w-full"
            />
          ) : isViewMode ? (
            <h1 className="px-2 py-1.5 text-sm font-semibold text-slate-800 truncate dark:text-slate-100" title={displayTitle}>
              {displayTitle}
            </h1>
          ) : (
            <h1 className="min-w-0">
              <button
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg max-w-full hover:bg-slate-100 group dark:hover:bg-slate-800 transition"
                title="Clique para renomear"
              >
                <span className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100">{displayTitle}</span>
                <Edit2 className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex-shrink-0" />
                <span className="sr-only">(renomear)</span>
              </button>
            </h1>
          )}
        </div>

        <div className="flex items-center flex-shrink-0">
          {isViewMode ? (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
              title="O dono do quadro deixou o link apenas para visualização"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Só visualização</span>
              <span className="sr-only sm:hidden">Só visualização</span>
            </span>
          ) : (
            <SyncIndicator status={syncStatus} />
          )}
        </div>
      </div>

      {/* Right: collaborators + share + profile menu */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="hidden sm:flex items-center -space-x-2 px-1" aria-label={`${otherCollaborators.length} outras pessoas online`}>
          {visibleCollaborators.map((collab) => (
            <Avatar
              key={collab.id}
              name={collab.name}
              color={collab.color}
              className="w-8 h-8 border-2 border-white dark:border-slate-900 hover:z-10 hover:scale-110 transition-transform"
              title={collab.name}
            />
          ))}
          {hiddenCount > 0 && (
            <span
              className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-700 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-200"
              title={`Mais ${hiddenCount} pessoas online`}
            >
              +{hiddenCount}
            </span>
          )}
        </div>

        {/* Compact online counter on mobile */}
        {otherCollaborators.length > 0 && (
          <span
            className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold dark:bg-emerald-950/40 dark:text-emerald-300"
            title={`Mais ${otherCollaborators.length} pessoas online`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            +{otherCollaborators.length}
          </span>
        )}

        <button
          onClick={onOpenShare}
          className="h-10 flex items-center gap-1.5 px-3 sm:px-4 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-sm font-semibold shadow-sm shadow-brand-600/30 transition"
          aria-label="Compartilhar"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Compartilhar</span>
        </button>

        {/* Profile / options menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-haspopup="menu"
            aria-expanded={showMenu}
            aria-label="Perfil e opções"
            title="Perfil e opções"
          >
            <Avatar
              name={effectiveUserName}
              color={guestProfile.color}
              className="w-8 h-8 ring-2"
            />
          </button>

          {showMenu && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 dark:bg-slate-900 dark:border-slate-800 animate-pop-in origin-top-right"
            >
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <Avatar name={effectiveUserName} color={guestProfile.color} className="w-9 h-9" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{effectiveUserName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {isAuthenticated ? user?.email : 'Convidado'}
                  </p>
                </div>
              </div>

              <div className="py-1">
                <button role="menuitem" className={menuItemClass} onClick={() => runMenuAction(onOpenNickname)}>
                  <UserPen className="w-4 h-4 text-slate-500" />
                  <span>Editar nome e cor</span>
                </button>
                <button role="menuitem" className={menuItemClass} onClick={() => runMenuAction(toggleTheme)}>
                  {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
                  <span>{isDark ? 'Tema claro' : 'Tema escuro'}</span>
                </button>
              </div>

              {onExport && (
                <div className="py-1 border-t border-slate-100 dark:border-slate-800">
                  <p className="px-4 pt-1.5 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Exportar</p>
                  <button role="menuitem" className={menuItemClass} onClick={() => runMenuAction(() => onExport('png'))}>
                    <Image className="w-4 h-4 text-slate-500" />
                    <span>Imagem PNG</span>
                  </button>
                  <button role="menuitem" className={menuItemClass} onClick={() => runMenuAction(() => onExport('svg'))}>
                    <FileCode className="w-4 h-4 text-slate-500" />
                    <span>Vetor SVG</span>
                  </button>
                </div>
              )}

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                {isAuthenticated ? (
                  <button
                    role="menuitem"
                    className={cn(menuItemClass, 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40')}
                    onClick={() => runMenuAction(() => signOut())}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da conta</span>
                  </button>
                ) : (
                  <button
                    role="menuitem"
                    className={cn(menuItemClass, 'text-brand-700 dark:text-brand-300 font-semibold')}
                    onClick={() => runMenuAction(onOpenAuth)}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Entrar para salvar na conta</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
