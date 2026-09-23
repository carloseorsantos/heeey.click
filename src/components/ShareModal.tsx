import { useState } from 'react';
import { Copy, Check, Users, Lock, Globe } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AccessLevel } from '../lib/types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  accessLevel: AccessLevel;
  isOwner: boolean;
  onUpdateAccessLevel: (newLevel: AccessLevel) => Promise<void>;
}

// Celebrate only the first copy of the session; repeated confetti gets noisy
let hasCelebratedCopy = false;

const ACCESS_OPTIONS: {
  level: AccessLevel;
  label: string;
  description: string;
  Icon: typeof Globe;
}[] = [
  { level: 'edit', label: 'Pode editar', description: 'Qualquer pessoa com o link desenha junto', Icon: Globe },
  { level: 'view', label: 'Só visualizar', description: 'Quem abrir o link apenas vê o quadro', Icon: Lock },
];

export function ShareModal({
  isOpen,
  onClose,
  accessLevel,
  isOwner,
  onUpdateAccessLevel,
}: ShareModalProps) {
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
      setCopied(true);
      if (!hasCelebratedCopy && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        hasCelebratedCopy = true;
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      }
      setTimeout(() => setCopied(false), 2500);
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
      title="Compartilhar quadro"
      description="Quem tiver o link entra na hora, sem criar conta."
      icon={
        <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 flex-shrink-0">
          <Users className="w-5 h-5" />
        </div>
      }
    >
      {/* Link input + Copy */}
      <div className="space-y-2 mb-6">
        <label htmlFor="share-url" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Link do quadro
        </label>
        <div className="flex items-center gap-2">
          <input
            id="share-url"
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          />
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition shadow-sm flex-shrink-0',
              copied ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-600 hover:bg-brand-700 active:scale-95'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span aria-live="polite">{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* Permission Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span id="share-permission-label" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Quem tem o link
          </span>
          {!isOwner && (
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-300">
              Só quem criou pode alterar
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby="share-permission-label">
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
                  'p-3 rounded-xl border text-left transition flex flex-col justify-between',
                  isSelected
                    ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-600/20 dark:bg-brand-950/30 dark:border-brand-500'
                    : 'border-slate-200 bg-white dark:bg-slate-800/60 dark:border-slate-700',
                  isOwner && !isSelected && 'hover:bg-slate-50 dark:hover:bg-slate-800',
                  !isOwner && !isSelected && 'opacity-50 cursor-not-allowed',
                  !isOwner && isSelected && 'cursor-default'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
                    )}
                  />
                  {isSelected && <Check className="w-4 h-4 text-brand-600 dark:text-brand-400" />}
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">{description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
        Tudo é salvo automaticamente e aparece em tempo real para quem está no quadro.
      </p>
    </Modal>
  );
}
