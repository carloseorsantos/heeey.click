import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SettingsModal, type SettingsSection } from '../components/settings/SettingsModal';

interface SettingsContextValue {
  openSettings: (section?: SettingsSection) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** One Settings window for the whole app, opened from any screen (or with ⌘,) */
export function SettingsProvider({ children, onOpenDocs }: { children: React.ReactNode; onOpenDocs?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>('profile');

  const openSettings = useCallback((next?: SettingsSection) => {
    if (next) setSection(next);
    setIsOpen(true);
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

  const value = useMemo(() => ({ openSettings }), [openSettings]);

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
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
