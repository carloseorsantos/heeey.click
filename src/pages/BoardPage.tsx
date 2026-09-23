import { useState, useEffect, useMemo } from 'react';
import {
  Excalidraw,
  convertToExcalidrawElements,
  viewportCoordsToSceneCoords,
  exportToBlob,
  exportToSvg,
  useHandleLibrary,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Loader2, X, Trash2, RotateCcw } from 'lucide-react';
import { useRealtimeBoard } from '../hooks/useRealtimeBoard';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Header } from '../components/Header';
import { ShareModal } from '../components/ShareModal';
import { AuthModal } from '../components/AuthModal';
import { NicknameModal } from '../components/NicknameModal';
import { VersionHistoryModal } from '../components/VersionHistoryModal';
import { BoardSearchModal } from '../components/BoardSearchModal';
import { HeeeyLogo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { isBoardLocallyCreated } from '../lib/storage';
import { generateId } from '../lib/utils';
import { optimizeAndUploadImage } from '../lib/imageOptimizer';
import { createLibraryAdapter, createGuestLibraryMigration } from '../lib/libraryAdapter';
import { useI18n } from '../i18n';

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
  onBackToDashboard: () => void;
  onOpenBoard: (boardId: string) => void;
  onNavigateToDocs?: () => void;
}

export function BoardPage({ boardId, onBackToDashboard, onOpenBoard, onNavigateToDocs }: BoardPageProps) {
  const {
    board,
    loading,
    syncStatus,
    onlineCollaborators,
    isViewMode,
    isTrashed,
    isOwner,
    excalidrawAPI,
    setExcalidrawAPI,
    handleCanvasChange,
    handlePointerUpdate,
    updateTitle,
    updateAccessLevel,
    restoreBoard,
    restoreVersion,
  } = useRealtimeBoard({ boardId });

  const { user, effectiveUserName, guestProfile } = useAuth();
  const { theme } = useTheme();
  const { t, excalidrawLangCode } = useI18n();

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNicknameOpen, setIsNicknameOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Personal library: this browser for guests, synced with the account when signed in
  const libraryAdapter = useMemo(() => createLibraryAdapter(user?.id), [user?.id]);
  const libraryMigrationAdapter = useMemo(() => createGuestLibraryMigration(user?.id), [user?.id]);
  useHandleLibrary({
    excalidrawAPI,
    adapter: libraryAdapter,
    migrationAdapter: libraryMigrationAdapter,
  });
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [restoreState, setRestoreState] = useState<'idle' | 'restoring' | 'error'>('idle');

  const handleRestore = async () => {
    setRestoreState('restoring');
    const ok = await restoreBoard();
    setRestoreState(ok ? 'idle' : 'error');
  };

  // Export board as PNG or SVG
  const handleExport = async (format: 'png' | 'svg') => {
    const api = excalidrawAPI;
    if (!api) return;

    try {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();
      const safeTitle = (board?.title || t('board.fileName')).replace(/[/\\?%*:|"<>]/g, '-').trim();

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

  if (loading || !board) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
        <div className="flex flex-col items-center space-y-4" role="status">
          <HeeeyLogo className="w-14 h-14 shadow-xl shadow-brand-600/30 animate-pulse" />
          <div className="flex items-center space-x-2 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            <span>{t('board.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-900">
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
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenNickname={() => setIsNicknameOpen(true)}
        onBackToDashboard={onBackToDashboard}
        onOpenDocs={onNavigateToDocs}
        onExport={handleExport}
        onOpenHistory={isViewMode ? undefined : () => setIsHistoryOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Excalidraw Canvas Area */}
      <main className="flex-1 w-full h-[calc(100vh-3.5rem)] relative">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={{
            elements: board.elements || [],
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
        />

        {/* Trashed board banner: read-only until the owner restores it */}
        {isTrashed && (
          <div
            role="status"
            className="absolute top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 sm:w-max sm:max-w-[calc(100%-2rem)] flex items-center gap-3 pl-3 pr-2 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 animate-pop-in"
          >
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              {restoreState === 'error'
                ? t('board.restoreError')
                : isOwner
                  ? t('board.trashedOwner')
                  : t('board.trashedViewer')}
            </span>
            {isOwner && (
              <button
                onClick={handleRestore}
                disabled={restoreState === 'restoring'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition flex-shrink-0 disabled:opacity-60"
              >
                {restoreState === 'restoring' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>{t('common.restore')}</span>
              </button>
            )}
          </div>
        )}

        {/* First-time guest visitor prompt banner */}
        {showGuestPrompt && (
          <div
            role="dialog"
            aria-label={t('board.welcome')}
            className="absolute bottom-20 right-4 left-4 sm:left-auto z-30 sm:max-w-sm p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-brand-100 dark:border-slate-800 animate-pop-in"
          >
            <div className="flex items-start space-x-3">
              <Avatar name={effectiveUserName} color={guestProfile.color} className="w-10 h-10 text-xs" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t('board.welcomeTitle')}</h4>
                  <button
                    onClick={() => {
                      setShowGuestPrompt(false);
                      safeSetStorage(sessionStorage, `heeey_guest_prompt_dismissed_${boardId}`, 'true');
                    }}
                    className="-mt-2 -mr-2 w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    aria-label={t('common.close')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {t('board.joinedAsBefore')} <strong className="text-slate-900 dark:text-white">{effectiveUserName}</strong>
                  {t('board.joinedAsAfter')}
                </p>
                <div className="mt-3 flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setShowGuestPrompt(false);
                      setIsNicknameOpen(true);
                    }}
                    className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.97] text-white rounded-xl text-sm font-semibold shadow-md shadow-brand-600/20 transition"
                  >
                    {t('board.customize')}
                  </button>
                  <button
                    onClick={() => {
                      setShowGuestPrompt(false);
                      safeSetStorage(sessionStorage, `heeey_guest_prompt_dismissed_${boardId}`, 'true');
                    }}
                    className="px-3 py-2 rounded-xl text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 font-medium transition"
                  >
                    {t('board.notNow')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Optimizing image indicator pill */}
        {isOptimizingImage && (
          <div
            role="status"
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-full text-sm font-medium shadow-2xl flex items-center gap-2 z-30 animate-fade-in"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
            <span>{t('board.optimizingImage')}</span>
          </div>
        )}
      </main>

      {/* Modals */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        boardId={board.id}
        accessLevel={board.access_level}
        isOwner={isOwner}
        onUpdateAccessLevel={updateAccessLevel}
      />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <NicknameModal isOpen={isNicknameOpen} onClose={() => setIsNicknameOpen(false)} />

      <BoardSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        currentBoardId={board.id}
        onOpenBoard={onOpenBoard}
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
