import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, Check, Users, Lock, Globe } from 'lucide-react';
import { AccessLevel } from '../lib/types';
import { cn } from '../lib/utils';
import { Modal, ModalIcon } from './Modal';
import { Button } from './ui/Button';
import { useI18n, type MessageKey } from '../i18n';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  accessLevel: AccessLevel;
  isOwner: boolean;
  onUpdateAccessLevel: (newLevel: AccessLevel) => Promise<void>;
}

const ACCESS_OPTIONS: {
  level: AccessLevel;
  label: MessageKey;
  description: MessageKey;
  Icon: typeof Globe;
}[] = [
  { level: 'edit', label: 'share.canEdit', description: 'share.canEditDescription', Icon: Globe },
  { level: 'view', label: 'share.viewOnly', description: 'share.viewOnlyDescription', Icon: Lock },
];

export function ShareModal({
  isOpen,
  onClose,
  accessLevel,
  isOwner,
  onUpdateAccessLevel,
}: ShareModalProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);

  const shareUrl = window.location.href;

  async function handleCopy() {
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        success = true;
      }
    } catch (err) {
      console.warn('Clipboard API falhou, tentando fallback:', err);
    }

    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        console.error('Falha no fallback de cópia:', e);
      }
    }

    if (success) {
      // Completion feedback on the control that caused it
      setCopied(true);
      navigator.vibrate?.(10);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleToggleLevel(level: AccessLevel) {
    if (!isOwner || updating || level === accessLevel) return;
    setUpdating(true);
    try {
      await onUpdateAccessLevel(level);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('share.title')}
      description={t('share.description')}
      icon={
        <ModalIcon>
          <Users />
        </ModalIcon>
      }
    >
      {/* Link + copy */}
      <label htmlFor="share-url" className="block text-callout font-medium text-label mb-1.5">
        {t('share.link')}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="share-url"
          type="text"
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="field flex-1 min-w-0 font-mono text-xs text-label-2"
        />
        <Button
          variant={copied ? 'tinted' : 'primary'}
          onClick={handleCopy}
          className={cn('min-w-[6.5rem]', copied && 'bg-success/15 text-success hover:bg-success/15')}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={copied ? 'copied' : 'copy'}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
              className="flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" strokeWidth={2.75} /> : <Copy className="w-4 h-4" />}
              <span aria-live="polite">{copied ? t('share.copied') : t('common.copy')}</span>
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>

      {/* Permission: an inset grouped list with a checkmark on the choice */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
          <span id="share-permission-label" className="section-label">
            {t('share.whoHasLink')}
          </span>
          {!isOwner && <span className="text-xs text-label-2">{t('share.onlyOwner')}</span>}
        </div>

        <div
          className="rounded-xl bg-fill overflow-hidden divide-y divide-separator"
          role="radiogroup"
          aria-labelledby="share-permission-label"
        >
          {ACCESS_OPTIONS.map(({ level, label, description, Icon }) => {
            const isSelected = accessLevel === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!isOwner || updating}
                onClick={() => handleToggleLevel(level)}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors',
                  isOwner && !isSelected && 'hover:bg-fill',
                  !isOwner && !isSelected && 'opacity-50 cursor-not-allowed',
                  !isOwner && isSelected && 'cursor-default'
                )}
              >
                <span
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    isSelected ? 'bg-accent text-white' : 'bg-fill-2 text-label-2'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-label">{t(label)}</span>
                  <span className="block text-xs text-label-2">{t(description)}</span>
                </span>
                <Check
                  className={cn('w-4 h-4 text-accent-text flex-shrink-0 transition-opacity', isSelected ? 'opacity-100' : 'opacity-0')}
                  strokeWidth={2.75}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 px-1 text-xs text-label-2">{t('share.autosave')}</p>
    </Modal>
  );
}
