import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { MotionConfig } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './hooks/useSettings';
import { TeamsProvider } from './hooks/useTeams';
import { ClaimBoardsDialog } from './components/ClaimBoardsDialog';
import { ThemeProvider } from './hooks/useTheme';
import { DashboardPage } from './pages/DashboardPage';
import { HeeeyLogo } from './components/Logo';
import { I18nProvider, useI18n } from './i18n';
import { redactEvent } from './lib/analytics';

// The editor (Excalidraw) is only downloaded when a board is opened
const BoardPage = lazy(() =>
  import('./pages/BoardPage').then((module) => ({ default: module.BoardPage }))
);

const InvitePage = lazy(() =>
  import('./pages/InvitePage').then((module) => ({ default: module.InvitePage }))
);

const DocsPage = lazy(() =>
  import('./pages/DocsPage').then((module) => ({ default: module.DocsPage }))
);

function BoardLoadingScreen() {
  const { t } = useI18n();
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-app" role="status">
      <HeeeyLogo className="w-12 h-12 animate-pulse" />
      <span className="sr-only">{t('app.loadingBoard')}</span>
    </div>
  );
}

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
    setCurrentPath(path);
  }, []);

  // Parse path: /b/:boardId, /docs (with optional slug), /t/:team(/p/:project), /shared, /invite/:token or /
  const boardMatch = currentPath.match(/^\/b\/([^/]+)/);
  const boardId = boardMatch ? boardMatch[1] : null;

  const teamMatch = currentPath.match(/^\/t\/([^/]+)(?:\/p\/([^/]+))?\/?$/);
  const teamSlug = teamMatch ? decodeURIComponent(teamMatch[1]) : null;
  const projectId = teamMatch?.[2] ?? null;
  const isShared = /^\/shared\/?$/.test(currentPath);
  const inviteMatch = currentPath.match(/^\/invite\/([^/]+)/);
  const inviteToken = inviteMatch ? inviteMatch[1] : null;

  const docsMatch = currentPath.match(/^\/docs(?:\/(.*))?$/);
  const isDocs = Boolean(docsMatch);
  const docsSlug = docsMatch ? docsMatch[1] || '' : null;

  return (
    <MotionConfig reducedMotion="user">
    <I18nProvider>
    <ThemeProvider>
      <AuthProvider>
      <TeamsProvider>
      <SettingsProvider onOpenDocs={() => navigate('/docs')}>
        {boardId ? (
          <Suspense fallback={<BoardLoadingScreen />}>
            {/* key: switching boards remounts the editor with the new scene */}
            <BoardPage
              key={boardId}
              boardId={boardId}
              onBackToDashboard={(path) => navigate(path ?? '/app')}
              onOpenBoard={(id) => navigate(`/b/${id}`)}
              onNavigateToDocs={() => navigate('/docs')}
            />
          </Suspense>
        ) : inviteToken ? (
          <Suspense fallback={<BoardLoadingScreen />}>
            <InvitePage
              token={inviteToken}
              onOpenTeam={(slug) => navigate(`/t/${slug}`, { replace: true })}
              onBackToDashboard={() => navigate('/app')}
            />
          </Suspense>
        ) : isDocs ? (
          <Suspense fallback={<BoardLoadingScreen />}>
            <DocsPage
              slug={docsSlug || 'getting-started'}
              onNavigateDoc={(slug) => navigate(`/docs/${slug}`)}
              onBackToDashboard={() => navigate('/app')}
              onNavigateToBoard={(id) => navigate(`/b/${id}`)}
            />
          </Suspense>
        ) : (
          <DashboardPage
            onNavigateToBoard={(id) => navigate(`/b/${id}`)}
            onNavigateToDocs={() => navigate('/docs')}
            onNavigate={navigate}
            teamSlug={teamSlug}
            projectId={projectId}
            section={isShared ? 'shared' : null}
          />
        )}
        {/* Boards created before signing in: ask where they go (any screen) */}
        <ClaimBoardsDialog />
      </SettingsProvider>
      </TeamsProvider>
      </AuthProvider>
    </ThemeProvider>
    </I18nProvider>
    <Analytics beforeSend={redactEvent} />
    </MotionConfig>
  );
}

export default App;
