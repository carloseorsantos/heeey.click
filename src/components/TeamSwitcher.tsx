import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react';
import { Team } from '../lib/teams';
import { cn } from '../lib/utils';
import { useDismiss } from '../hooks/useDismiss';
import { useI18n } from '../i18n';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './ui/Menu';

/** Squircle with the team's initial; the hue comes from the team id so it stays stable */
export function TeamAvatar({ team, className }: { team: Pick<Team, 'id' | 'name'>; className?: string }) {
  let hash = 0;
  for (const char of team.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const initial = Array.from(team.name.trim())[0]?.toUpperCase() ?? '?';
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: `hsl(${hash % 360} 62% 46%)` }}
      className={cn(
        'flex items-center justify-center flex-shrink-0 rounded-md text-white text-xs font-semibold shadow-[inset_0_0.5px_0_rgba(255,255,255,0.3)]',
        className ?? 'w-6 h-6'
      )}
    >
      {initial}
    </span>
  );
}

interface TeamSwitcherProps {
  teams: Team[];
  activeTeam: Team;
  onSelect: (team: Team) => void;
  onCreate: () => void;
  onOpenSettings: () => void;
  /** Compact trigger for the phone toolbar */
  compact?: boolean;
}

/** Switches between the user's teams, like the account switcher of Vercel or Supabase */
export function TeamSwitcher({ teams, activeTeam, onSelect, onCreate, onOpenSettings, compact }: TeamSwitcherProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useDismiss<HTMLDivElement>(open, close);

  function run(action: () => void) {
    close();
    action();
  }

  return (
    <div className={cn('relative', !compact && 'w-full')} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('teams.switch', { name: activeTeam.name })}
        className={cn(
          'pressable flex items-center gap-2 rounded-lg text-left hover:bg-fill transition-colors',
          compact ? 'h-9 px-1.5 max-w-[11rem]' : 'w-full h-10 px-2',
          open && 'bg-fill'
        )}
      >
        <TeamAvatar team={activeTeam} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-label truncate">{activeTeam.name}</span>
          {!compact && (
            <span className="block text-2xs text-label-2 truncate">
              {activeTeam.is_personal ? t('teams.personal') : t(`teams.roles.${activeTeam.my_role}`)}
            </span>
          )}
        </span>
        <ChevronsUpDown className="w-4 h-4 text-label-2 flex-shrink-0" />
      </button>

      <Menu open={open} align="start" className="w-64" aria-label={t('teams.title')}>
        <MenuLabel>{t('teams.title')}</MenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              role="menuitem"
              onClick={() => run(() => onSelect(team))}
              className="w-full flex items-center gap-2.5 h-10 px-2.5 rounded-lg text-sm text-left outline-none hover:bg-fill-2 focus-visible:bg-fill-2 transition-colors duration-100"
            >
              <TeamAvatar team={team} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-label">{team.name}</span>
                <span className="block text-2xs text-label-2 truncate">
                  {team.is_personal ? t('teams.personal') : t(`teams.roles.${team.my_role}`)}
                </span>
              </span>
              {team.id === activeTeam.id && <Check className="w-4 h-4 text-accent-text flex-shrink-0" strokeWidth={2.75} aria-label={t('teams.current')} />}
            </button>
          ))}
        </div>
        <MenuSeparator />
        <MenuItem icon={Settings2} onClick={() => run(onOpenSettings)}>
          {t('teams.settings')}
        </MenuItem>
        <MenuItem icon={Plus} onClick={() => run(onCreate)}>
          {t('teams.create')}
        </MenuItem>
      </Menu>
    </div>
  );
}
