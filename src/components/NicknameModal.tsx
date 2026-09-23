import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Modal } from './Modal';
import { Button } from './ui/Button';
import { Avatar } from './Avatar';
import { useI18n, type MessageKey } from '../i18n';

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

interface NicknameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NicknameModal({ isOpen, onClose }: NicknameModalProps) {
  const { guestProfile, effectiveUserName, setNickname } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState(effectiveUserName || guestProfile.name);
  const [selectedColor, setSelectedColor] = useState(guestProfile.color);

  useEffect(() => {
    if (isOpen) {
      setName(effectiveUserName || guestProfile.name);
      setSelectedColor(guestProfile.color);
    }
  }, [isOpen, effectiveUserName, guestProfile.color]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim()) {
      setNickname(name.trim(), selectedColor);
      try {
        localStorage.setItem('heeey_guest_customized', 'true');
      } catch (err) {
        // ignore localStorage errors
      }
    }
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={t('profile.title')}
      description={t('profile.description')}
      icon={<Avatar name={name || '?'} color={selectedColor} className="w-10 h-10 text-sm" />}
    >
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label htmlFor="nickname" className="block text-callout font-medium text-label mb-1.5">
            {t('profile.name')}
          </label>
          <input
            id="nickname"
            type="text"
            required
            maxLength={25}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field h-11"
            placeholder={t('profile.namePlaceholder')}
            autoFocus
          />
        </div>

        <fieldset>
          <legend className="block text-callout font-medium text-label mb-2.5">{t('profile.color')}</legend>
          <div className="grid grid-cols-5 gap-3 justify-items-center">
            {COLOR_OPTIONS.map((c) => {
              const isSelected = selectedColor.stroke === c.stroke;
              return (
                <button
                  key={c.stroke}
                  type="button"
                  onClick={() => setSelectedColor({ background: c.background, stroke: c.stroke })}
                  className={`pressable w-10 h-10 rounded-full flex items-center justify-center ring-offset-2 ring-offset-surface-raised ${
                    isSelected ? 'ring-2' : ''
                  }`}
                  style={{ backgroundColor: c.stroke, ['--tw-ring-color' as string]: c.stroke }}
                  aria-label={t(c.label)}
                  aria-pressed={isSelected}
                  title={t(c.label)}
                >
                  {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="pt-1 flex items-center gap-2">
          <Button onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
