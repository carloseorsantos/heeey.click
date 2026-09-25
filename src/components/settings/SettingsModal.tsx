import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Sun,
  UserRound,
  X,
  BookOpen,
  CircleUser,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { project, spring } from '../../lib/motion';
import { useIsCompact } from '../../hooks/useMediaQuery';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, type ThemePreference } from '../../hooks/useTheme';
import { LOCALES, useI18n, type Locale, type MessageKey } from '../../i18n';
import { HeeeyLogo } from '../Logo';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SettingsGroup, SettingsRow } from './SettingsGroup';
import { ProfilePanel } from './ProfilePanel';
import { AuthForm } from './AuthForm';
import { ApiKeysPanel } from './ApiKeysPanel';
import { TeamPanel } from './TeamPanel';

export type SettingsSection = 'profile' | 'appearance' | 'account' | 'team' | 'integrations' | 'about';

const SECTIONS: { id: SettingsSection; label: MessageKey; icon: LucideIcon; tint: string }[] = [
  { id: 'profile', label: 'settings.profile', icon: UserRound, tint: 'bg-[#7c3aed]' },
  { id: 'appearance', label: 'settings.appearance', icon: Palette, tint: 'bg-[#0a84ff]' },
  { id: 'account', label: 'settings.account', icon: CircleUser, tint: 'bg-[#30b04f]' },
  { id: 'team', label: 'settings.team', icon: UsersRound, tint: 'bg-[#5e5ce6]' },
  { id: 'integrations', label: 'settings.integrations', icon: KeyRound, tint: 'bg-[#ff9500]' },
  { id: 'about', label: 'settings.about', icon: Info, tint: 'bg-[#8e8e93]' },
];

export function isSettingsSection(value: string): value is SettingsSection {
  return SECTIONS.some((s) => s.id === value);
}

const APP_VERSION = '0.1.0';
const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/** Colored squircle behind a white symbol, like System Settings */
function SectionIcon({ icon: Icon, tint, size = 'sm' }: { icon: LucideIcon; tint: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex items-center justify-center text-white flex-shrink-0 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.3)]',
        size === 'sm' ? 'w-6 h-6 rounded-md' : 'w-7 h-7 rounded-lg',
        tint
      )}
    >
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={2.25} />
    </span>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onClose: () => void;
  onOpenDocs?: () => void;
}

/**
 * All preferences in one place. A sidebar + detail window on wide screens; on phones a
 * bottom sheet with a navigation stack: sections push in from the right and pop back to it.
 */
export function SettingsModal({ isOpen, section, onSectionChange, onClose, onOpenDocs }: SettingsModalProps) {
  const { t } = useI18n();
  const isCompact = useIsCompact();
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Phones start on the section list; a section is "pushed" on top of it
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useDialogFocus(isOpen, dialogRef, onClose);

  function openSection(id: SettingsSection) {
    onSectionChange(id);
    setIsDetailOpen(true);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const height = dialogRef.current?.offsetHeight ?? 600;
    if (info.velocity.y >= 0 && info.offset.y + project(info.velocity.y) > height * 0.35) onClose();
  }

  function handlePageDragEnd(_: unknown, info: PanInfo) {
    const width = dialogRef.current?.offsetWidth ?? 375;
    if (info.velocity.x >= 0 && info.offset.x + project(info.velocity.x) > width * 0.4) setIsDetailOpen(false);
  }

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const showDetail = !isCompact || isDetailOpen;

  const shellMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : isCompact
      ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: spring.default }
      : {
          initial: { opacity: 0, scale: 0.96 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
          transition: spring.snappy,
        };

  // Push/pop on phones: in from the right, back out to the right (same path both ways)
  const pageMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };

  const sectionList = (
    <nav aria-label={t('settings.title')} className={cn(isCompact ? 'rounded-xl bg-fill divide-y divide-separator overflow-hidden' : 'space-y-0.5')}>
      {SECTIONS.map(({ id, label, icon, tint }) => {
        const selected = !isCompact && id === section;
        return (
          <button
            key={id}
            type="button"
            onClick={() => (isCompact ? openSection(id) : onSectionChange(id))}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 text-left transition-colors duration-100',
              isCompact ? 'h-12 px-3.5 text-base active:bg-fill-2' : 'h-8 px-2 rounded-lg text-sm',
              !isCompact && (selected ? 'bg-fill-2 font-medium' : 'hover:bg-fill')
            )}
          >
            <SectionIcon icon={icon} tint={tint} size={isCompact ? 'md' : 'sm'} />
            <span className="flex-1 truncate text-label">{t(label)}</span>
            {isCompact && <ChevronRight className="w-4 h-4 text-label-3" />}
          </button>
        );
      })}
    </nav>
  );

  return createPortal(
    <AnimatePresence onExitComplete={() => setIsDetailOpen(false)}>
      {isOpen && (
        <motion.div key="settings" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-[var(--scrim)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onMouseDown={onClose}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            {...shellMotion}
            drag={isCompact && !reduceMotion ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 1 }}
            dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative w-full flex material-thick shadow-sheet outline-none overflow-hidden',
              'h-[92dvh] rounded-t-[1.375rem] flex-col',
              'sm:h-[min(40rem,calc(100dvh-3rem))] sm:max-w-3xl sm:rounded-2xl sm:flex-row'
            )}
          >
            {/* Sidebar (wide screens) */}
            {!isCompact && (
              <aside className="w-56 flex-shrink-0 flex flex-col bg-fill border-r border-separator">
                <h2 id={titleId} className="px-4 pt-5 pb-3 text-lg font-semibold text-label">
                  {t('settings.title')}
                </h2>
                <div className="px-2 flex-1 overflow-y-auto">{sectionList}</div>
              </aside>
            )}

            {/* Phones: grabber + title bar, which is also the drag handle */}
            {isCompact && (
              <div onPointerDown={(e) => dragControls.start(e)} className="flex-shrink-0 touch-none">
                <div className="flex justify-center pt-2 pb-1" aria-hidden="true">
                  <div className="w-9 h-[5px] rounded-full bg-label-3/40" />
                </div>
                <div className="relative h-11 flex items-center justify-center px-2">
                  <AnimatePresence initial={false}>
                    {isDetailOpen && (
                      <motion.button
                        key="back"
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsDetailOpen(false)}
                        className="absolute left-1 flex items-center h-9 pl-1 pr-2 rounded-lg text-accent-text"
                      >
                        <ChevronLeft className="w-6 h-6 -mr-0.5" strokeWidth={2.25} />
                        <span className="text-[0.9375rem] truncate max-w-[6.5rem]">{t('settings.back')}</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <h2 id={titleId} className="text-[0.9375rem] font-semibold text-label truncate max-w-[38%]">
                    {isDetailOpen ? t(current.label) : t('settings.title')}
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className="pressable absolute right-3 w-8 h-8 flex items-center justify-center rounded-full bg-fill text-label-2"
                    aria-label={t('common.close')}
                  >
                    <X className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}

            <div className="relative flex-1 min-w-0 min-h-0">
              {isCompact && (
                <div className="absolute inset-0 overflow-y-auto px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  {sectionList}
                </div>
              )}

              <AnimatePresence initial={false}>
                {showDetail && (
                  <motion.div
                    key={isCompact ? 'detail' : 'pane'}
                    {...(isCompact ? pageMotion : {})}
                    transition={spring.default}
                    // Swipe the page back to the right to return to the list, like an iOS back swipe
                    drag={isCompact && !reduceMotion ? 'x' : false}
                    dragDirectionLock
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0, right: 1 }}
                    onDragEnd={handlePageDragEnd}
                    style={isCompact ? { touchAction: 'pan-y' } : undefined}
                    className="absolute inset-0 flex flex-col bg-surface sm:bg-transparent"
                  >
                    {!isCompact && (
                      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 flex-shrink-0">
                        <h3 className="text-xl font-semibold text-label">{t(current.label)}</h3>
                        <button
                          type="button"
                          onClick={onClose}
                          className="pressable -mr-1 w-8 h-8 flex items-center justify-center rounded-full bg-fill text-label-2 hover:text-label hover:bg-fill-2"
                          aria-label={t('common.close')}
                        >
                          <X className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                    <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 pt-2 sm:pt-0 pb-6">
                      {/* New section shows at once and fades in; no waiting on the old one */}
                      <motion.div key={section} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                        <SectionContent
                          section={section}
                          onNavigate={openSection}
                          onOpenDocs={
                            onOpenDocs
                              ? () => {
                                  onClose();
                                  onOpenDocs();
                                }
                              : undefined
                          }
                        />
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function SectionContent({
  section,
  onNavigate,
  onOpenDocs,
}: {
  section: SettingsSection;
  onNavigate: (section: SettingsSection) => void;
  onOpenDocs?: () => void;
}) {
  const { t, locale, setLocale } = useI18n();
  const { preference, setPreference } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();

  switch (section) {
    case 'profile':
      return <ProfilePanel />;

    case 'appearance':
      return (
        <div className="space-y-6">
          <SettingsGroup footer={t('settings.canvasNote')}>
            <SettingsRow label={t('settings.theme')}>
              <SegmentedControl<ThemePreference>
                aria-label={t('settings.theme')}
                value={preference}
                onChange={setPreference}
                className="w-full sm:w-72"
                options={[
                  { value: 'light', label: t('settings.themeLight'), icon: Sun },
                  { value: 'dark', label: t('settings.themeDark'), icon: Moon },
                  { value: 'system', label: t('settings.themeSystem'), icon: Monitor },
                ]}
              />
            </SettingsRow>
          </SettingsGroup>
          <SettingsGroup>
            <SettingsRow label={t('settings.language')}>
              <SegmentedControl<Locale>
                aria-label={t('settings.language')}
                value={locale}
                onChange={setLocale}
                className="w-full sm:w-72"
                options={LOCALES.map((l) => ({ value: l.id, label: l.label, lang: l.id }))}
              />
            </SettingsRow>
          </SettingsGroup>
        </div>
      );

    case 'account':
      return isAuthenticated ? (
        <div className="space-y-6">
          <SettingsGroup footer={t('settings.accountSignedIn')}>
            <SettingsRow label={t('settings.email')}>
              <span className="text-sm text-label-2 break-all">{user?.email}</span>
            </SettingsRow>
          </SettingsGroup>
          <SettingsGroup title={t('settings.session')}>
            <SettingsRow label={t('header.signOut')}>
              <Button variant="danger-plain" size="sm" onClick={() => signOut()}>
                <LogOut className="w-4 h-4" />
                <span>{t('header.signOut')}</span>
              </Button>
            </SettingsRow>
          </SettingsGroup>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-label-2">
            {t('settings.accountGuest')} {t('auth.optional')}
          </p>
          <SettingsGroup title={t('settings.signInTitle')} footer={t('auth.description')}>
            <div className="p-4">
              <AuthForm />
            </div>
          </SettingsGroup>
        </div>
      );

    case 'team':
      return isAuthenticated ? (
        <TeamPanel />
      ) : (
        <div className="flex flex-col items-center text-center py-10 px-4">
          <div className="w-14 h-14 rounded-2xl bg-fill text-label-2 flex items-center justify-center mb-4">
            <UsersRound className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-label-2 max-w-xs">{t('settings.teamGuest')}</p>
          <Button variant="tinted" className="mt-4" onClick={() => onNavigate('account')}>
            {t('settings.goToAccount')}
          </Button>
        </div>
      );

    case 'integrations':
      return isAuthenticated ? (
        <div className="space-y-4">
          <p className="text-sm text-label-2">{t('apiKeys.description')}</p>
          <ApiKeysPanel />
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-10 px-4">
          <div className="w-14 h-14 rounded-2xl bg-fill text-label-2 flex items-center justify-center mb-4">
            <KeyRound className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-label-2 max-w-xs">{t('settings.integrationsGuest')}</p>
          <Button variant="tinted" className="mt-4" onClick={() => onNavigate('account')}>
            {t('settings.goToAccount')}
          </Button>
        </div>
      );

    case 'about':
      return (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center pt-2">
            <HeeeyLogo className="w-16 h-16 mb-3 drop-shadow-[0_8px_16px_rgba(124,58,237,0.25)]" />
            <p className="text-lg font-semibold text-label">heeey.click</p>
            <p className="text-callout text-label-2">
              {t('settings.version')} {APP_VERSION}
            </p>
            <p className="text-sm text-label-2 mt-2 max-w-sm">{t('settings.aboutBody')}</p>
          </div>

          <SettingsGroup title={t('settings.shortcuts')}>
            <SettingsRow label={t('settings.shortcutSettings')} className="sm:flex-row flex-row items-center">
              <Kbd keys={[MOD_KEY, ',']} />
            </SettingsRow>
            <SettingsRow label={t('settings.shortcutSearch')} className="sm:flex-row flex-row items-center">
              <Kbd keys={['/']} />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title={t('settings.links')}>
            {onOpenDocs && (
              <button type="button" onClick={onOpenDocs} className="w-full flex items-center gap-3 px-4 h-12 text-left hover:bg-fill transition-colors">
                <BookOpen className="w-4 h-4 text-label-2" />
                <span className="flex-1 text-sm text-label">{t('dashboard.documentation')}</span>
                <ChevronRight className="w-4 h-4 text-label-3" />
              </button>
            )}
            <a
              href="https://github.com/carloseorsantos/heeey.click"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 h-12 hover:bg-fill transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-label-2" />
              <span className="flex-1 text-sm text-label">GitHub</span>
              <ChevronRight className="w-4 h-4 text-label-3" />
            </a>
          </SettingsGroup>
        </div>
      );
  }
}

function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <kbd
          key={key}
          className="min-w-6 h-6 px-1.5 flex items-center justify-center rounded-md bg-surface shadow-[0_0_0_0.5px_var(--separator),0_1px_0_var(--separator)] text-xs font-sans text-label-2"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
