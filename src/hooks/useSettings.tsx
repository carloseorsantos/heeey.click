import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { SettingsModal, isSettingsSection, type SettingsSection } from '../components/settings/SettingsModal';
import { AuthForm, type AuthMode } from '../components/settings/AuthForm';
import { Modal, ModalIcon } from '../components/Modal';
import { useI18n } from '../i18n';
import { useAuth } from './useAuth';

interface SettingsContextValue {
  openSettings: (section?: SettingsSection) => void;
  openAuthDialog: (mode: AuthMode) => void;
}

const AUTH_DIALOGS: AuthMode[] = ['signup', 'login'];
const AUTH_DIALOG_DELAY_MS = 500;

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** One Settings window for the whole app, opened from any screen (or with ⌘,) */
export function SettingsProvider({ children, onOpenDocs }: { children: React.ReactNode; onOpenDocs?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>('profile');
  const [authDialog, setAuthDialog] = useState<AuthMode | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useI18n();

  const openSettings = useCallback((next?: SettingsSection) => {
    if (next) setSection(next);
    setIsOpen(true);
  }, []);

  // Drop the dialog once signed in (e.g. ?login while already signed in, or the magic link
  // opened in another tab) so it does not pop up after signing out, and when Settings opens
  // so the two never stack. Watches authDialog too: the deep link sets it after a delay
  useEffect(() => {
    if (authDialog && (isAuthenticated || isOpen)) setAuthDialog(null);
  }, [authDialog, isAuthenticated, isOpen]);

  // Deep links so landing pages can send visitors straight to sign up or in (?signup, ?login)
  // or to a section (?settings=account)
  useEffect(() => {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get('settings');
    const dialog = AUTH_DIALOGS.find((d) => url.searchParams.has(d));
    if (dialog) {
      // Let the dashboard land first so the dialog reads as arriving on top of it. No cleanup:
      // the provider lives as long as the app, and Strict Mode's second run finds no param
      window.setTimeout(() => setAuthDialog(dialog), AUTH_DIALOG_DELAY_MS);
    } else if (requested && isSettingsSection(requested)) {
      setSection(requested);
      setIsOpen(true);
    } else {
      return;
    }
    // Drop the params so the magic link redirect (current URL) and reloads stay clean
    AUTH_DIALOGS.forEach((d) => url.searchParams.delete(d));
    url.searchParams.delete('settings');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  // ⌘, / Ctrl+, like every desktop app
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== ',' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      setIsOpen(true);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value = useMemo(() => ({ openSettings, openAuthDialog: setAuthDialog }), [openSettings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
      <SettingsModal
        isOpen={isOpen}
        section={section}
        onSectionChange={setSection}
        onClose={() => setIsOpen(false)}
        onOpenDocs={onOpenDocs}
      />
      {/* Waits for the session so signed-in visitors never see it flash */}
      <Modal
        isOpen={!!authDialog && !authLoading && !isAuthenticated}
        onClose={() => setAuthDialog(null)}
        title={authDialog === 'login' ? t('auth.title') : t('auth.createAccount')}
        description={t('auth.description')}
        icon={<ModalIcon>{authDialog === 'login' ? <LogIn /> : <UserPlus />}</ModalIcon>}
      >
        <div className="pt-2">
          <AuthForm mode={authDialog ?? 'signup'} />
          <p className="mt-5 text-center text-sm text-label-2">
            {authDialog === 'login' ? t('auth.noAccountYet') : t('auth.haveAccount')}{' '}
            <button
              type="button"
              onClick={() => setAuthDialog(authDialog === 'login' ? 'signup' : 'login')}
              className="font-medium text-accent-text underline-offset-2 hover:underline"
            >
              {authDialog === 'login' ? t('auth.createAccount') : t('dashboard.signIn')}
            </button>
          </p>
        </div>
      </Modal>
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
