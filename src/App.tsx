import { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { DashboardPage } from './pages/DashboardPage';
import { BoardPage } from './pages/BoardPage';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  }, []);

  // Parse path: /b/:boardId or /
  const boardMatch = currentPath.match(/^\/b\/([^/]+)/);
  const boardId = boardMatch ? boardMatch[1] : null;

  return (
    <ThemeProvider>
      <AuthProvider>
        {boardId ? (
          <BoardPage boardId={boardId} onBackToDashboard={() => navigate('/')} />
        ) : (
          <DashboardPage onNavigateToBoard={(id) => navigate(`/b/${id}`)} />
        )}
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
