import { useState } from 'react';
import { BookOpen, KeyRound, Languages, LogIn, LogOut, Moon, Sun, UserPen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useDismiss } from '../hooks/useDismiss';
import { useI18n } from '../i18n';
import { Avatar } from './Avatar';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';

interface AccountMenuProps {
  onEditProfile: () => void;
  onSignIn: () => void;
  onOpenApiKeys?: () => void;
  onOpenDocs?: () => void;
  /** Extra, context-specific sections (rendered as `(close) => ReactNode` so items can close the menu) */
  children?: (close: () => void) => React.ReactNode;
}

/** One place for everything about "me": profile, preferences, account */
export function AccountMenu({ onEditProfile, onSignIn, onOpenApiKeys, onOpenDocs, children }: AccountMenuProps) {
  const { user, isAuthenticated, signOut, effectiveUserName, guestProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();
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
        <div className="flex items-center gap-3 px-2.5 pt-1.5 pb-2.5">
          <Avatar name={effectiveUserName} color={guestProfile.color} className="w-9 h-9 text-xs" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-label truncate">{effectiveUserName}</p>
            <p className="text-xs text-label-2 truncate">{isAuthenticated ? user?.email : t('header.guest')}</p>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem icon={UserPen} onClick={() => run(onEditProfile)}>
          {t('header.editProfile')}
        </MenuItem>
        {isAuthenticated && onOpenApiKeys && (
          <MenuItem icon={KeyRound} onClick={() => run(onOpenApiKeys)}>
            {t('dashboard.apiKeys')}
          </MenuItem>
        )}
        {children?.(close)}
        <MenuSeparator />
        <MenuItem icon={isDark ? Sun : Moon} onClick={() => run(toggleTheme)}>
          {isDark ? t('header.lightTheme') : t('header.darkTheme')}
        </MenuItem>
        <MenuItem
          icon={Languages}
          lang={locale === 'pt-BR' ? 'en' : 'pt-BR'}
          onClick={() => run(() => setLocale(locale === 'pt-BR' ? 'en' : 'pt-BR'))}
        >
          {t('language.switchTo')}
        </MenuItem>
        {onOpenDocs && (
          <MenuItem icon={BookOpen} onClick={() => run(onOpenDocs)}>
            {t('header.documentation')}
          </MenuItem>
        )}
        <MenuSeparator />
        {isAuthenticated ? (
          <MenuItem icon={LogOut} destructive onClick={() => run(() => signOut())}>
            {t('header.signOut')}
          </MenuItem>
        ) : (
          <MenuItem icon={LogIn} onClick={() => run(onSignIn)} className="text-accent-text font-medium [&>svg]:text-accent-text">
            {t('header.signInToSave')}
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}
