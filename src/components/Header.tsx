import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  CloudCheck,
  CloudOff,
  AlertCircle,
  Loader2,
  Eye,
  Image,
  FileCode,
  History,
  Search,
} from 'lucide-react';
import { CollaboratorUser, SyncStatus, AccessLevel } from '../lib/types';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';
import { Avatar } from './Avatar';
import { AccountMenu } from './AccountMenu';
import { Button } from './ui/Button';
import { MenuItem, MenuLabel, MenuSeparator } from './ui/Menu';

interface HeaderProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  syncStatus: SyncStatus;
  accessLevel: AccessLevel;
  isViewMode: boolean;
  isTrashed?: boolean;
  onlineCollaborators: CollaboratorUser[];
  onOpenShare: () => void;
  onOpenAuth: () => void;
  onOpenNickname: () => void;
  onBackToDashboard: () => void;
  onOpenDocs?: () => void;
  onExport?: (format: 'png' | 'svg') => void;
  /** Only passed to people who can edit the board */
  onOpenHistory?: () => void;
  onOpenSearch?: () => void;
}

const MAX_VISIBLE_AVATARS = 4;

/** Document status as a quiet subtitle under the title, like "Edited" on a macOS window */
function DocumentStatus({ status, isViewMode, isTrashed }: { status: SyncStatus; isViewMode: boolean; isTrashed: boolean }) {
  const { t } = useI18n();
  const base = 'flex items-center gap-1 text-2xs leading-none whitespace-nowrap';

  if (isViewMode) {
    return (
      <span className={cn(base, 'text-warning')} title={isTrashed ? t('header.trashedReadOnly') : t('header.viewOnlyTitle')}>
        <Eye className="w-3 h-3" />
        <span>{t('header.viewOnly')}</span>
      </span>
    );
  }

  switch (status) {
    case 'saving':
      return (
        <span className={cn(base, 'text-label-2')} role="status">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{t('sync.saving')}</span>
        </span>
      );
    case 'saved':
      return (
        <span className={cn(base, 'text-label-2')} role="status" title={t('sync.savedTitle')}>
          <CloudCheck className="w-3 h-3" />
          <span>{t('sync.saved')}</span>
        </span>
      );
    case 'offline':
      return (
        <span className={cn(base, 'text-warning')} role="status" title={t('sync.offlineTitle')}>
          <CloudOff className="w-3 h-3" />
          <span>{t('sync.offline')}</span>
        </span>
      );
    case 'error':
      return (
        <span className={cn(base, 'text-danger-text font-medium')} role="alert" title={t('sync.errorTitle')}>
          <AlertCircle className="w-3 h-3" />
          <span>{t('sync.error')}</span>
        </span>
      );
  }
}

export function Header({
  title,
  onUpdateTitle,
  syncStatus,
  isViewMode,
  isTrashed = false,
  onlineCollaborators,
  onOpenShare,
  onOpenAuth,
  onOpenNickname,
  onBackToDashboard,
  onOpenDocs,
  onExport,
  onOpenHistory,
  onOpenSearch,
}: HeaderProps) {
  const { t } = useI18n();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

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

  const displayTitle = title || t('board.untitled');
  // The current user is already represented by the profile button on the far right
  const otherCollaborators = onlineCollaborators.filter((c) => !c.isCurrentUser);
  const visibleCollaborators = otherCollaborators.slice(0, MAX_VISIBLE_AVATARS);
  const hiddenCount = otherCollaborators.length - visibleCollaborators.length;

  return (
    <header className="relative h-[3.25rem] material-chrome shadow-[0_0.5px_0_var(--separator)] pl-1.5 pr-2 sm:px-3 flex items-center justify-between gap-2 z-30 select-none">
      {/* Left: back + document title with its status */}
      <div className="flex items-center gap-1 min-w-0">
        <Button
          variant="plain"
          iconOnly
          onClick={onBackToDashboard}
          className="text-accent-text hover:text-accent-text"
          aria-label={t('header.back')}
          title={t('header.back')}
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2.25} />
        </Button>

        <div className="min-w-0 max-w-[42vw] sm:max-w-xs md:max-w-sm flex flex-col justify-center">
          {!isViewMode && isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
              aria-label={t('header.boardTitle')}
              className="field h-8 px-2 text-sm font-semibold"
            />
          ) : (
            <>
              {isViewMode ? (
                <h1 className="px-1.5 text-sm font-semibold text-label truncate" title={displayTitle}>
                  {displayTitle}
                </h1>
              ) : (
                <h1 className="min-w-0">
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="max-w-full px-1.5 -my-0.5 py-0.5 rounded-md text-sm font-semibold text-label truncate block hover:bg-fill transition-colors"
                    title={t('header.clickToRename')}
                  >
                    {displayTitle}
                    <span className="sr-only"> {t('header.renameHint')}</span>
                  </button>
                </h1>
              )}
              <div className="px-1.5 mt-0.5">
                <DocumentStatus status={syncStatus} isViewMode={isViewMode} isTrashed={isTrashed} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: presence + actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {otherCollaborators.length > 0 && (
          <div
            className="hidden sm:flex items-center -space-x-1.5 pr-1.5"
            aria-label={t('header.othersOnline', { count: otherCollaborators.length })}
          >
            {visibleCollaborators.map((collab) => (
              <Avatar
                key={collab.id}
                name={collab.name}
                color={collab.color}
                className="w-7 h-7 text-[10px] shadow-[0_0_0_2px_rgb(var(--surface))] transition-transform duration-200 hover:z-10 hover:-translate-y-0.5"
                title={collab.name}
              />
            ))}
            {hiddenCount > 0 && (
              <span
                className="w-7 h-7 rounded-full bg-fill-2 shadow-[0_0_0_2px_rgb(var(--surface))] flex items-center justify-center text-[10px] font-semibold text-label-2"
                title={t('header.moreOnline', { count: hiddenCount })}
              >
                +{hiddenCount}
              </span>
            )}
          </div>
        )}

        {/* Compact online counter on phones */}
        {otherCollaborators.length > 0 && (
          <span
            className="sm:hidden flex items-center gap-1 h-6 px-2 rounded-full bg-success/15 text-success text-xs font-semibold"
            title={t('header.moreOnline', { count: otherCollaborators.length })}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {otherCollaborators.length}
          </span>
        )}

        {onOpenSearch && (
          <Button
            variant="plain"
            iconOnly
            onClick={onOpenSearch}
            aria-label={t('header.goToBoard')}
            title={t('header.goToBoard')}
          >
            <Search className="w-[18px] h-[18px]" />
          </Button>
        )}

        <Button variant="primary" size="sm" onClick={onOpenShare} className="h-8 px-3.5">
          {t('header.share')}
        </Button>

        <AccountMenu onEditProfile={onOpenNickname} onSignIn={onOpenAuth} onOpenDocs={onOpenDocs}>
          {(close) => (
            <>
              {onOpenHistory && (
                <MenuItem
                  icon={History}
                  onClick={() => {
                    close();
                    onOpenHistory();
                  }}
                >
                  {t('header.history')}
                </MenuItem>
              )}
              {onExport && (
                <>
                  <MenuSeparator />
                  <MenuLabel>{t('header.export')}</MenuLabel>
                  <MenuItem
                    icon={Image}
                    onClick={() => {
                      close();
                      onExport('png');
                    }}
                  >
                    {t('header.exportPng')}
                  </MenuItem>
                  <MenuItem
                    icon={FileCode}
                    onClick={() => {
                      close();
                      onExport('svg');
                    }}
                  >
                    {t('header.exportSvg')}
                  </MenuItem>
                </>
              )}
            </>
          )}
        </AccountMenu>
      </div>
    </header>
  );
}
