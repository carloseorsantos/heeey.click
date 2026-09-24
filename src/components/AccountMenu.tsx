import { useState } from 'react';
import { BookOpen, ChevronRight, LogIn, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDismiss } from '../hooks/useDismiss';
import { useSettings } from '../hooks/useSettings';
import { useI18n } from '../i18n';
import { Avatar } from './Avatar';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';

interface AccountMenuProps {
  onOpenDocs?: () => void;
  /** Extra, context-specific sections (rendered as `(close) => ReactNode` so items can close the menu) */
  children?: (close: () => void) => React.ReactNode;
}

const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

/** Who I am, plus the way into Settings; preferences themselves live in Settings */
export function AccountMenu({ onOpenDocs, children }: AccountMenuProps) {
  const { user, isAuthenticated, signOut, effectiveUserName, guestProfile } = useAuth();
  const { openSettings, openAuthDialog } = useSettings();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useDismiss<HTMLDivElement>(open, close);

  function run(action: () => void) {
    close();
    action();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pressable w-10 h-10 flex items-center justify-center rounded-full hover:bg-fill"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.profileMenu')}
        title={t('header.profileMenu')}
      >
        <Avatar name={effectiveUserName} color={guestProfile.color} className="w-8 h-8" />
      </button>

      <Menu open={open} className="w-72" aria-label={t('header.profileMenu')}>
        {/* The identity row opens the profile, where name and color are edited */}
        <button
          type="button"
          role="menuitem"
          onClick={() => run(() => openSettings('profile'))}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left outline-none hover:bg-fill-2 focus-visible:bg-fill-2 transition-colors duration-100"
          title={t('header.editProfile')}
        >
          <Avatar name={effectiveUserName} color={guestProfile.color} className="w-9 h-9 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-label truncate">{effectiveUserName}</p>
            <p className="text-xs text-label-2 truncate">{isAuthenticated ? user?.email : t('header.guest')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-label-3" />
        </button>
        <MenuSeparator />
        <MenuItem icon={Settings} shortcut={`${MOD_KEY},`} onClick={() => run(() => openSettings())}>
          {t('settings.open')}
        </MenuItem>
        {onOpenDocs && (
          <MenuItem icon={BookOpen} onClick={() => run(onOpenDocs)}>
            {t('header.documentation')}
          </MenuItem>
        )}
        {children?.(close)}
        <MenuSeparator />
        {isAuthenticated ? (
          <MenuItem icon={LogOut} destructive onClick={() => run(() => signOut())}>
            {t('header.signOut')}
          </MenuItem>
        ) : (
          <MenuItem
            icon={LogIn}
            onClick={() => run(() => openAuthDialog('login'))}
            className="text-accent-text font-medium [&>svg]:text-accent-text"
          >
            {t('header.signInToSave')}
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}
