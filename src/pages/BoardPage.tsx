import { useState, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { Loader2 } from 'lucide-react';
import { useRealtimeBoard } from '../hooks/useRealtimeBoard';
import { Header } from '../components/Header';
import { ShareModal } from '../components/ShareModal';
import { AuthModal } from '../components/AuthModal';
import { NicknameModal } from '../components/NicknameModal';
import { HeeeyLogo } from '../components/Logo';

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
    setExcalidrawAPI,
    handleCanvasChange,
    handlePointerUpdate,
    updateTitle,
    updateAccessLevel,
  } = useRealtimeBoard({ boardId });

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNicknameOpen, setIsNicknameOpen] = useState(false);

  // Update browser document title with board name
  useEffect(() => {
    if (board?.title) {
      document.title = `${board.title} — Heeey`;
    }
    return () => {
      document.title = 'Heeey — Whiteboard Colaborativo';
    };
  }, [board?.title]);

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
