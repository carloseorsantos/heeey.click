import { useState, useEffect } from 'react';
import {
  Excalidraw,
  convertToExcalidrawElements,
  viewportCoordsToSceneCoords,
  exportToBlob,
  exportToSvg,
} from '@excalidraw/excalidraw';
import { Loader2, UserCircle, X, Sparkles } from 'lucide-react';
import { useRealtimeBoard } from '../hooks/useRealtimeBoard';
import { useAuth } from '../hooks/useAuth';
import { Header } from '../components/Header';
import { ShareModal } from '../components/ShareModal';
import { AuthModal } from '../components/AuthModal';
import { NicknameModal } from '../components/NicknameModal';
import { HeeeyLogo } from '../components/Logo';
import { isBoardLocallyCreated } from '../lib/storage';
import { generateId } from '../lib/utils';
import { optimizeAndUploadImage } from '../lib/imageOptimizer';

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
}

export function BoardPage({ boardId, onBackToDashboard }: BoardPageProps) {
  const {
    board,
    loading,
    syncStatus,
    onlineCollaborators,
    isViewMode,
    isOwner,
    excalidrawAPI,
    setExcalidrawAPI,
    handleCanvasChange,
    handlePointerUpdate,
    updateTitle,
    updateAccessLevel,
  } = useRealtimeBoard({ boardId });

  const { user, effectiveUserName, guestProfile } = useAuth();

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNicknameOpen, setIsNicknameOpen] = useState(false);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Initialize theme from storage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('heeey_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Export board as PNG or SVG
  const handleExport = async (format: 'png' | 'svg') => {
    const api = excalidrawAPI;
    if (!api) return;

    try {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();
      const safeTitle = (board?.title || 'quadro').replace(/[/\\?%*:|"<>]/g, '-').trim();

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
      document.title = 'Heeey — Whiteboard Colaborativo';
    };
  }, [board?.title]);

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
        <div className="flex flex-col items-center space-y-4">
          <HeeeyLogo className="w-14 h-14 shadow-xl shadow-violet-600/30 animate-pulse" />
          <div className="flex items-center space-x-2 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
            <span>Carregando sua lousa...</span>
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
        onlineCollaborators={onlineCollaborators}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenNickname={() => setIsNicknameOpen(true)}
        onBackToDashboard={onBackToDashboard}
        onExport={handleExport}
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
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: !isViewMode,
              clearCanvas: !isViewMode,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: true,
              saveAsImage: true,
            },
          }}
        />

        {/* First-time guest visitor prompt banner */}
        {showGuestPrompt && (
          <div className="absolute top-4 right-4 z-30 max-w-sm p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-violet-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start space-x-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md transition-colors"
                style={{ backgroundColor: guestProfile.color.stroke }}
              >
                <UserCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                    <span>Bem-vindo à lousa!</span>
                  </h4>
                  <button
                    onClick={() => {
                      setShowGuestPrompt(false);
                      safeSetStorage(sessionStorage, `heeey_guest_prompt_dismissed_${boardId}`, 'true');
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Fechar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Você entrou como <strong className="text-violet-600 dark:text-violet-400">{effectiveUserName}</strong>. Deseja escolher seu próprio apelido e cor de cursor?
                </p>
                <div className="mt-3 flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setShowGuestPrompt(false);
                      setIsNicknameOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-violet-600/20 transition"
                  >
                    Personalizar Perfil
                  </button>
                  <button
                    onClick={() => {
                      setShowGuestPrompt(false);
                      safeSetStorage(sessionStorage, `heeey_guest_prompt_dismissed_${boardId}`, 'true');
                    }}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Optimizing image indicator pill */}
        {isOptimizingImage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-full text-xs font-medium shadow-2xl flex items-center space-x-2 z-30 animate-in fade-in duration-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
            <span>Otimizando e comprimindo imagem...</span>
          </div>
        )}

        {/* Floating View Mode Banner for non-owners */}
        {isViewMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-full text-xs font-medium shadow-xl flex items-center space-x-2 pointer-events-none z-20">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Modo Somente Leitura ativado pelo proprietário</span>
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
    </div>
  );
}
