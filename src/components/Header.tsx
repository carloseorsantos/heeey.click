import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Cloud,
  CloudCheck,
  Loader2,
  Share2,
  LogIn,
  LogOut,
  Eye,
  Edit2,
  Users,
} from 'lucide-react';
import { CollaboratorUser, SyncStatus, AccessLevel } from '../lib/types';
import { getInitials } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { HeeeyLogo } from './Logo';

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
}: HeaderProps) {
  const { user, isAuthenticated, signOut, effectiveUserName, guestProfile } = useAuth();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleTitleSubmit() {
    setIsEditingTitle(false);
    if (currentTitle.trim() && currentTitle !== title) {
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

  return (
    <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 flex items-center justify-between z-30 select-none dark:bg-slate-900/95 dark:border-slate-800">
      {/* Left section: Back button + Logo + Editable Title + Sync Status */}
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={onBackToDashboard}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
          title="Voltar aos Meus Quadros"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Brand */}
        <div 
          onClick={onBackToDashboard}
          className="hidden sm:flex items-center space-x-1.5 cursor-pointer group"
        >
          <HeeeyLogo className="w-7 h-7 shadow-md shadow-violet-500/25 group-hover:scale-105 transition-transform" />
          <span className="font-bold text-slate-800 text-sm tracking-tight dark:text-white">
            heeey<span className="text-violet-600">.click</span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        {/* Title */}
        <div className="min-w-0 max-w-[140px] sm:max-w-xs md:max-w-sm">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
              className="px-2 py-1 text-sm font-semibold bg-violet-50 border border-violet-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white w-full"
            />
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer group dark:hover:bg-slate-800 transition"
              title="Clique para renomear"
            >
              <h1 className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100">
                {title || 'Quadro sem título'}
              </h1>
              <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          )}
        </div>

        {/* Mode / Sync indicator */}
        <div className="hidden md:flex items-center space-x-2">
          {isViewMode ? (
            <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
              <Eye className="w-3 h-3" />
              <span>Apenas Visualização</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-xs text-slate-400">
              {syncStatus === 'saving' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />
                  <span className="text-violet-600">Salvando...</span>
                </>
              ) : (
                <>
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-400">Salvo</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Right section: Online avatars + Share Button + Profile/Auth */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Collaborators online avatars */}
        <div className="flex items-center -space-x-2 overflow-hidden py-1 px-1">
          {onlineCollaborators.slice(0, 4).map((collab) => (
            <div
              key={collab.id}
              className="relative inline-block"
              title={`${collab.name} ${collab.isCurrentUser ? '(Você)' : ''}`}
            >
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-bold text-white shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 transition-transform hover:scale-110 hover:z-10"
                style={{ backgroundColor: collab.color.stroke }}
              >
                {getInitials(collab.name)}
              </div>
            </div>
          ))}

          {onlineCollaborators.length > 4 && (
            <div 
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200"
              title={`${onlineCollaborators.length - 4} outros colaboradores online`}
            >
              +{onlineCollaborators.length - 4}
            </div>
          )}
        </div>

        {/* Change Nickname Button */}
        <button
          onClick={onOpenNickname}
          className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 transition"
          title="Alterar seu nome e cor de colaborador"
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: guestProfile.color.stroke }}
          />
          <span className="truncate max-w-[100px]">{effectiveUserName}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={onOpenShare}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-xs font-semibold shadow-sm shadow-violet-600/30 transition"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Compartilhar</span>
        </button>

        {/* User Auth / Profile */}
        <div className="relative" ref={menuRef}>
          {isAuthenticated ? (
            <div>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                title={user?.email || 'Minha conta'}
              >
                {getInitials(user?.email || 'User')}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 dark:bg-slate-900 dark:border-slate-800 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                      {user?.email}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                      Conta sincronizada
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenNickname();
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center space-x-2"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Personalizar perfil</span>
                  </button>

                  <button
                    onClick={async () => {
                      setShowUserMenu(false);
                      await signOut();
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 flex items-center space-x-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition"
              title="Entrar com Magic Link"
            >
              <LogIn className="w-3.5 h-3.5 text-violet-600" />
              <span className="hidden sm:inline">Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
