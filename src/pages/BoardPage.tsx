import { useState, useEffect, useMemo } from 'react';
import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  viewportCoordsToSceneCoords,
  exportToBlob,
  exportToSvg,
  useHandleLibrary,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, X, Trash2, RotateCcw, Lock, Clock, Sparkles } from 'lucide-react';
import { spring } from '../lib/motion';
import { Button } from '../components/ui/Button';
import { useRealtimeBoard } from '../hooks/useRealtimeBoard';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { Header } from '../components/Header';
import { ShareModal } from '../components/ShareModal';
import { VersionHistoryModal } from '../components/VersionHistoryModal';
import { BoardSearchModal } from '../components/BoardSearchModal';
import { ExportForAIModal } from '../components/ExportForAIModal';
import { HeeeyLogo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { isBoardLocallyCreated } from '../lib/storage';
import { fitTextHeights, generateId } from '../lib/utils';
import { optimizeAndUploadImage } from '../lib/imageOptimizer';
import { createLibraryAdapter, createGuestLibraryMigration } from '../lib/libraryAdapter';
import { useI18n } from '../i18n';
import { formatDateShort } from '../lib/utils';

function safeGetStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage errors in restricted iframe or private browsing contexts
  }
}

interface BoardPageProps {
  boardId: string;
  /** path: where to go back to (the board's project); the dashboard's default otherwise */
  onBackToDashboard: (path?: string) => void;
  onOpenBoard: (boardId: string) => void;
  /** slug: a docs page (e.g. "mcp/getting-started"); the docs home otherwise */
  onNavigateToDocs?: (slug?: string) => void;
}

export function BoardPage({ boardId, onBackToDashboard, onOpenBoard, onNavigateToDocs }: BoardPageProps) {
  const {
    board,
    loading,
    syncStatus,
    onlineCollaborators,
    isViewMode,
    isTrashed,
    canShare,
    canRestore,
    access,
    accessDenied,
    isAnonymousBoard,
    refreshAccess,
    excalidrawAPI,
    setExcalidrawAPI,
    handleCanvasChange,
    handlePointerUpdate,
    updateTitle,
    updateAccessLevel,
    restoreBoard,
    restoreVersion,
  } = useRealtimeBoard({ boardId });

  const { user, effectiveUserId, effectiveUserName, guestProfile, signOut } = useAuth();
  const { theme } = useTheme();
  const { t, excalidrawLangCode } = useI18n();

  const [isShareOpen, setIsShareOpen] = useState(false);
  const { openSettings, openAuthDialog } = useSettings();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExportForAIOpen, setIsExportForAIOpen] = useState(false);

  // Personal library: this browser for guests, synced with the account when signed in
  const libraryAdapter = useMemo(() => createLibraryAdapter(user?.id), [user?.id]);
  const libraryMigrationAdapter = useMemo(() => createGuestLibraryMigration(user?.id), [user?.id]);
  useHandleLibrary({
    excalidrawAPI,
    adapter: libraryAdapter,
    migrationAdapter: libraryMigrationAdapter,
  });
  // Boards saved with a single-line text height (e.g. older templates) would show only the first line.
  // Keyed on the board id: Excalidraw only reads initialData once
  const initialElements = useMemo(() => fitTextHeights(board?.elements || []), [board?.id]);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [restoreState, setRestoreState] = useState<'idle' | 'restoring' | 'error'>('idle');
  // Back to the project the board is in, when the user is in its team
  const backToDashboard = () =>
    onBackToDashboard(
      access?.team?.slug ? `/t/${access.team.slug}${access.project && !access.project.is_default ? `/p/${access.project.id}` : ''}` : undefined
    );

  const handleRestore = async () => {
    setRestoreState('restoring');
    const ok = await restoreBoard();
    setRestoreState(ok ? 'idle' : 'error');
  };

  // File name for downloads: the board title without characters that file systems reject
  const fileBaseName = () => (board?.title || t('board.fileName')).replace(/[/\\?%*:|"<>]/g, '-').trim();

  // Export board as PNG or SVG
  const handleExport = async (format: 'png' | 'svg') => {
    const api = excalidrawAPI;
    if (!api) return;

    try {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();
      const safeTitle = fileBaseName();

      if (format === 'png') {
        const blob = await exportToBlob({
          elements,
          appState: {
            ...appState,
            exportWithBackground: true,
          },
          files,
          mimeType: 'image/png',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle}.png`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const svg = await exportToSvg({
          elements,
          appState: {
            ...appState,
            exportWithBackground: true,
          },
          files,
        });
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.warn('Erro ao exportar quadro:', err);
    }
  };

  // Update browser document title with board name
  useEffect(() => {
    if (board?.title) {
      document.title = `${board.title} — Heeey`;
    }
    return () => {
      document.title = t('app.documentTitle');
    };
  }, [board?.title, t]);

  // Detect first-time guest visitors arriving via shared link and offer a gentle prompt
  useEffect(() => {
    if (loading || !board) return;

    const isSharedVisitor = !user && !isBoardLocallyCreated(boardId);
    const hasCustomized = safeGetStorage(localStorage, 'heeey_guest_customized');
    const hasDismissed = safeGetStorage(sessionStorage, `heeey_guest_prompt_dismissed_${boardId}`);

    if (isSharedVisitor && !hasCustomized && !hasDismissed) {
      const timer = setTimeout(() => {
        setShowGuestPrompt(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [board, boardId, loading, user]);

  // Intercept pasted and dropped images to optimize before inserting into Excalidraw
  useEffect(() => {
    if (isViewMode) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;

      const api = excalidrawAPI;
      if (!api) return;

      e.preventDefault();
      e.stopPropagation();

      setIsOptimizingImage(true);
      try {
        const fileId = generateId();
        const { dataURL: finalUrl, mimeType, width = 400, height = 300 } =
          await optimizeAndUploadImage(boardId, fileId, file);

        // Register binary file in Excalidraw with _optimized flag to prevent double processing
        api.addFiles([
          {
            id: fileId as any,
            dataURL: finalUrl as any,
            mimeType: mimeType as any,
            created: Date.now(),
            _optimized: true,
          } as any,
        ]);

        // Place image in center of current viewport
        const appState = api.getAppState();
        const clientX = window.innerWidth / 2;
        const clientY = window.innerHeight / 2;
        const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
          { clientX, clientY },
          appState
        );

        const maxDisplayDim = 600;
        let displayWidth = width;
        let displayHeight = height;
        if (displayWidth > maxDisplayDim || displayHeight > maxDisplayDim) {
          if (displayWidth > displayHeight) {
            displayHeight = Math.round((displayHeight / displayWidth) * maxDisplayDim);
            displayWidth = maxDisplayDim;
          } else {
            displayWidth = Math.round((displayWidth / displayHeight) * maxDisplayDim);
            displayHeight = maxDisplayDim;
          }
        }

        const elements = convertToExcalidrawElements([
          {
            type: 'image',
            fileId: fileId as any,
            status: 'saved',
            x: sceneX - displayWidth / 2,
            y: sceneY - displayHeight / 2,
            width: displayWidth,
            height: displayHeight,
          },
        ]);

        api.updateScene({
          elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
        });
      } catch (err) {
        console.warn('Erro ao otimizar imagem colada:', err);
      } finally {
        setIsOptimizingImage(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = async (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files || []);
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      const api = excalidrawAPI;
      if (!api) return;

      e.preventDefault();
      e.stopPropagation();

      setIsOptimizingImage(true);
      try {
        const appState = api.getAppState();
        const dropCoords = {
          clientX: e.clientX || window.innerWidth / 2,
          clientY: e.clientY || window.innerHeight / 2,
        };
        const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(dropCoords, appState);

        const filesToAdd: any[] = [];
        const elementsToAdd: any[] = [];
        let currentY = sceneY;

        for (const file of imageFiles) {
          const fileId = generateId();
          const { dataURL: finalUrl, mimeType, width = 400, height = 300 } =
            await optimizeAndUploadImage(boardId, fileId, file);

          filesToAdd.push({
            id: fileId as any,
            dataURL: finalUrl as any,
            mimeType: mimeType as any,
            created: Date.now(),
            _optimized: true,
          });

          const maxDisplayDim = 600;
          let displayWidth = width;
          let displayHeight = height;
          if (displayWidth > maxDisplayDim || displayHeight > maxDisplayDim) {
            if (displayWidth > displayHeight) {
              displayHeight = Math.round((displayHeight / displayWidth) * maxDisplayDim);
              displayWidth = maxDisplayDim;
            } else {
              displayWidth = Math.round((displayWidth / displayHeight) * maxDisplayDim);
              displayHeight = maxDisplayDim;
            }
          }

          const [imgEl] = convertToExcalidrawElements([
            {
              type: 'image',
              fileId: fileId as any,
              status: 'saved',
              x: sceneX - displayWidth / 2,
              y: currentY - displayHeight / 2,
              width: displayWidth,
              height: displayHeight,
            },
          ]);

          elementsToAdd.push(imgEl);
          currentY += displayHeight + 20;
        }

        if (filesToAdd.length > 0) {
          api.addFiles(filesToAdd);
          api.updateScene({
            elements: [...api.getSceneElementsIncludingDeleted(), ...elementsToAdd],
          });
        }
      } catch (err) {
        console.warn('Erro ao otimizar imagem arrastada:', err);
      } finally {
        setIsOptimizingImage(false);
      }
    };

    window.addEventListener('paste', handlePaste, true);
    window.addEventListener('dragover', handleDragOver, true);
    window.addEventListener('drop', handleDrop, true);

    return () => {
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('dragover', handleDragOver, true);
      window.removeEventListener('drop', handleDrop, true);
    };
  }, [boardId, excalidrawAPI, isViewMode]);

  // Restricted board and no access: never show (or create) a blank board in its place
  if (accessDenied) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-app px-4">
        <main className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-fill text-label-2 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-semibold text-label">{t('access.needAccessTitle')}</h1>
          <p className="mt-2 text-sm text-label-2 text-pretty">
            {user ? t('access.needAccessSignedIn', { email: user.email ?? '' }) : t('access.needAccessGuest')}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {user ? (
              <Button variant="secondary" onClick={() => signOut()}>
                {t('access.switchAccount')}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => openAuthDialog('login')}>
                {t('access.signIn')}
              </Button>
            )}
            <Button variant="plain" onClick={() => onBackToDashboard()}>
              {t('access.backToBoards')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (loading || !board) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-4" role="status">
          <HeeeyLogo className="w-12 h-12 animate-pulse" />
          <div className="flex items-center gap-2 text-sm text-label-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('board.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-app">
      {/* Top Header */}
      <Header
        title={board.title}
        onUpdateTitle={updateTitle}
        syncStatus={syncStatus}
        accessLevel={board.access_level}
        isViewMode={isViewMode}
        isTrashed={isTrashed}
        onlineCollaborators={onlineCollaborators}
        onOpenShare={() => setIsShareOpen(true)}
        onBackToDashboard={backToDashboard}
        onOpenDocs={onNavigateToDocs && (() => onNavigateToDocs())}
        onExport={handleExport}
        onOpenHistory={isViewMode ? undefined : () => setIsHistoryOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Excalidraw Canvas Area */}
      <main className="flex-1 w-full min-h-0 relative">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={{
            elements: initialElements,
            appState: {
              ...(board.app_state || {}),
              viewBackgroundColor: board.app_state?.viewBackgroundColor || '#ffffff',
            },
            files: board.files || {},
            scrollToContent: true,
          }}
          onChange={handleCanvasChange}
          onPointerUpdate={handlePointerUpdate}
          viewModeEnabled={isViewMode}
          isCollaborating={true}
          theme={theme}
          langCode={excalidrawLangCode}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: !isViewMode,
              clearCanvas: !isViewMode,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              saveAsImage: true,
            },
          }}
        >
          {/* Custom menu to add "Export for AI": the default items must be declared again, in the default order,
              without Excalidraw's own links */}
          <MainMenu>
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.SaveToActiveFile />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.Item icon={<Sparkles strokeWidth={1.5} />} onSelect={() => setIsExportForAIOpen(true)}>
              {t('exportAI.menuItem')}
            </MainMenu.Item>
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            {/* Only the canvas background follows (theme toggle is off), and it is hidden in view mode */}
            {!isViewMode && <MainMenu.Separator />}
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>

        {/* Trashed board banner: read-only until the owner restores it */}
        <AnimatePresence>
          {isTrashed && (
            <motion.div key="trashed" className="absolute top-3 inset-x-3 z-30 flex justify-center pointer-events-none">
              <motion.div
                role="status"
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={spring.default}
                className="pointer-events-auto w-full sm:w-max max-w-full flex items-center gap-3 pl-3.5 pr-1.5 py-1.5 rounded-2xl material-regular shadow-popover"
              >
                <Trash2 className="w-4 h-4 text-danger-text flex-shrink-0" />
                <span className="text-sm text-label">
                  {restoreState === 'error'
                    ? t('board.restoreError')
                    : canRestore
                      ? t('board.trashedOwner')
                      : t('board.trashedViewer')}
                </span>
                {canRestore && (
                  <Button variant="primary" size="sm" onClick={handleRestore} disabled={restoreState === 'restoring'}>
                    {restoreState === 'restoring' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    <span>{t('common.restore')}</span>
                  </Button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Migration with notice: visitors who only have the link learn it will stop working */}
        <AnimatePresence>
          {!isTrashed && board.restrict_link_at && !access?.member_permission && (board.access_level === 'edit' || board.access_level === 'view') && (
            <motion.div key="link-notice" className="absolute top-3 inset-x-3 z-30 flex justify-center pointer-events-none">
              <motion.div
                role="status"
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={spring.default}
                className="pointer-events-auto w-full sm:w-max max-w-full flex items-center gap-2.5 px-3.5 py-2 rounded-2xl material-regular shadow-popover"
              >
                <Clock className="w-4 h-4 text-warning flex-shrink-0" />
                <span className="text-sm text-label">{t('access.linkWillStop', { date: formatDateShort(board.restrict_link_at) })}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* First-time guest visitor prompt: a non-blocking panel, so no scrim */}
        <AnimatePresence>
          {showGuestPrompt && (
            <motion.div
              key="guest-prompt"
              role="dialog"
              aria-label={t('board.welcome')}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={spring.default}
              style={{ transformOrigin: 'bottom right' }}
              className="absolute bottom-20 right-3 left-3 sm:left-auto z-30 sm:max-w-sm p-4 rounded-2xl material-regular shadow-popover"
            >
              <div className="flex items-start gap-3">
                <Avatar id={effectiveUserId} color={guestProfile.color} className="w-10 h-10 text-xs" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-label pt-0.5">{t('board.welcomeTitle')}</h4>
                    <button
                      onClick={() => {
                        setShowGuestPrompt(false);
                        safeSetStorage(sessionStorage, `heeey_guest_prompt_dismissed_${boardId}`, 'true');
                      }}
                      className="pressable -mt-1 -mr-1 w-7 h-7 flex items-center justify-center rounded-full bg-fill text-label-2 hover:text-label flex-shrink-0"
                      aria-label={t('common.close')}
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="text-callout text-label-2 mt-1">
                    {t('board.joinedAsBefore')} <strong className="font-semibold text-label">{effectiveUserName}</strong>
                    {t('board.joinedAsAfter')}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setShowGuestPrompt(false);
                        openSettings('profile');
                      }}
                    >
                      {t('board.customize')}
                    </Button>
                    <Button
                      variant="plain"
                      size="sm"
                      onClick={() => {
                        setShowGuestPrompt(false);
                        safeSetStorage(sessionStorage, `heeey_guest_prompt_dismissed_${boardId}`, 'true');
                      }}
                    >
                      {t('board.notNow')}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Optimizing image indicator pill */}
        <AnimatePresence>
          {isOptimizingImage && (
            <motion.div key="optimizing" className="absolute top-3 inset-x-0 z-30 flex justify-center pointer-events-none">
              <motion.div
                role="status"
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring.snappy}
                className="h-9 px-4 rounded-full bg-[rgb(40_40_44/0.92)] backdrop-blur-xl text-white text-sm shadow-popover flex items-center gap-2"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('board.optimizingImage')}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        boardId={board.id}
        boardTitle={board.title}
        accessLevel={board.access_level}
        isAnonymous={isAnonymousBoard}
        isMember={!!access?.member_permission || canShare}
        onUpdateAccessLevel={updateAccessLevel}
        onAccessChanged={refreshAccess}
      />

      <BoardSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        currentBoardId={board.id}
        onOpenBoard={onOpenBoard}
      />

      <ExportForAIModal
        isOpen={isExportForAIOpen}
        onClose={() => setIsExportForAIOpen(false)}
        boardTitle={board.title}
        fileName={fileBaseName()}
        getElements={() => excalidrawAPI?.getSceneElements() ?? []}
        onOpenMcpDocs={onNavigateToDocs && (() => onNavigateToDocs('mcp/getting-started'))}
      />

      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        boardId={board.id}
        onRestore={restoreVersion}
      />
    </div>
  );
}
