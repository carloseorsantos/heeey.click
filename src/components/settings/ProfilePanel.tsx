import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useI18n, type MessageKey } from '../../i18n';
import { Avatar } from '../Avatar';
import { Button } from '../ui/Button';
import { SettingsGroup } from './SettingsGroup';

const COLOR_OPTIONS: { background: string; stroke: string; label: MessageKey }[] = [
  { background: '#fee2e2', stroke: '#ef4444', label: 'profile.colors.red' },
  { background: '#ffedd5', stroke: '#f97316', label: 'profile.colors.orange' },
  { background: '#fef3c7', stroke: '#f59e0b', label: 'profile.colors.amber' },
  { background: '#dcfce7', stroke: '#10b981', label: 'profile.colors.green' },
  { background: '#ccfbf1', stroke: '#14b8a6', label: 'profile.colors.teal' },
  { background: '#cffafe', stroke: '#06b6d4', label: 'profile.colors.cyan' },
  { background: '#e0e7ff', stroke: '#6366f1', label: 'profile.colors.indigo' },
  { background: '#f3e8ff', stroke: '#a855f7', label: 'profile.colors.purple' },
  { background: '#fae8ff', stroke: '#d946ef', label: 'profile.colors.fuchsia' },
  { background: '#fce7f3', stroke: '#ec4899', label: 'profile.colors.pink' },
];

const SAVED_MS = 2000;

/** Name and cursor color: how others see you on a board */
export function ProfilePanel() {
  const { guestProfile, effectiveUserId, effectiveUserName, setNickname } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState(effectiveUserName || guestProfile.name);
  const [color, setColor] = useState(guestProfile.color);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), SAVED_MS);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const isDirty = name.trim() !== effectiveUserName || color.stroke !== guestProfile.color.stroke;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !isDirty) return;
    setNickname(name.trim(), color);
    try {
      localStorage.setItem('heeey_guest_customized', 'true');
    } catch {
      // ignore localStorage errors
    }
    setJustSaved(true);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Live preview of how the avatar will look to others */}
      <div className="flex items-center gap-4">
        <Avatar id={effectiveUserId} color={color} className="w-14 h-14" animate="always" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-label truncate">{name || '?'}</p>
          <p className="text-callout text-label-2">{t('profile.description')}</p>
        </div>
      </div>

      <SettingsGroup title={t('profile.name')}>
        <div className="p-3">
          <input
            id="settings-nickname"
            type="text"
            required
            maxLength={25}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t('profile.name')}
            placeholder={t('profile.namePlaceholder')}
            className="field bg-surface"
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title={t('profile.color')}>
        <div className="grid grid-cols-5 gap-3 justify-items-center p-4" role="radiogroup" aria-label={t('profile.color')}>
          {COLOR_OPTIONS.map((c) => {
            const isSelected = color.stroke === c.stroke;
            return (
              <button
                key={c.stroke}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setColor({ background: c.background, stroke: c.stroke })}
                className={`pressable w-9 h-9 rounded-full flex items-center justify-center ring-offset-2 ring-offset-surface ${isSelected ? 'ring-2' : ''}`}
                style={{ backgroundColor: c.stroke, ['--tw-ring-color' as string]: c.stroke }}
                aria-label={t(c.label)}
                title={t(c.label)}
              >
                {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </SettingsGroup>

      <div className="flex items-center justify-end gap-3">
        {justSaved && (
          <span className="flex items-center gap-1 text-callout text-success" role="status">
            <Check className="w-4 h-4" strokeWidth={2.75} />
            {t('settings.saved')}
          </span>
        )}
        <Button type="submit" variant="primary" disabled={!isDirty || !name.trim()}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
