import { useState } from 'react';
import { X, Copy, Check, Users, Lock, Globe, ShieldCheck, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AccessLevel } from '../lib/types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  accessLevel: AccessLevel;
  isOwner: boolean;
  onUpdateAccessLevel: (newLevel: AccessLevel) => Promise<void>;
}

export function ShareModal({
  isOpen,
  onClose,
  accessLevel,
  isOwner,
  onUpdateAccessLevel,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!isOpen) return null;

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
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-500 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Compartilhar Quadro</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Colabore ao vivo com qualquer pessoa</p>
          </div>
        </div>

        {/* Guest Mode Highlight Notice */}
        <div className="rounded-xl bg-violet-50/70 border border-violet-100 p-3 mb-5 flex items-start space-x-2.5 dark:bg-violet-950/30 dark:border-violet-900/50">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-violet-950 dark:text-violet-200">
              Colaboração livre sem cadastro
            </p>
            <p className="text-[11px] text-violet-700 dark:text-violet-300 mt-0.5 leading-relaxed">
              Amigos não precisam criar conta nem fazer login por e-mail para desenhar. Basta abrir o link para interagir instantaneamente no modo convidado.
            </p>
          </div>
        </div>

        {/* Link input + Copy */}
        <div className="space-y-2 mb-6">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Link público compartilhável
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 select-all focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs text-white transition shadow-sm ${
                copied
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-violet-600 hover:bg-violet-700 active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Permission Switcher */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Permissão para quem possui o link
            </label>
            {isOwner ? (
              <span className="text-[11px] font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full dark:bg-violet-950/50 dark:text-violet-300">
                Você é o dono
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full dark:bg-slate-800">
                Apenas o criador altera
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Edit Option */}
            <button
              type="button"
              disabled={!isOwner || updating}
              onClick={() => handleToggleLevel('edit')}
              className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                accessLevel === 'edit'
                  ? 'border-violet-600 bg-violet-50/60 ring-2 ring-violet-600/20 dark:bg-violet-950/20 dark:border-violet-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700 dark:hover:bg-slate-800'
              } ${!isOwner ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <Globe className={`w-4 h-4 ${accessLevel === 'edit' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`} />
                {accessLevel === 'edit' && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Pode Editar</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  Qualquer visitante pode desenhar e colaborar
                </p>
              </div>
            </button>

            {/* View Option */}
            <button
              type="button"
              disabled={!isOwner || updating}
              onClick={() => handleToggleLevel('view')}
              className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                accessLevel === 'view'
                  ? 'border-violet-600 bg-violet-50/60 ring-2 ring-violet-600/20 dark:bg-violet-950/20 dark:border-violet-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700 dark:hover:bg-slate-800'
              } ${!isOwner ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <Lock className={`w-4 h-4 ${accessLevel === 'view' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`} />
                {accessLevel === 'view' && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Apenas Visualizar</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  Visitantes apenas visualizam o canvas
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Informative Footer */}
        <div className="rounded-xl bg-slate-50 p-3 flex items-start space-x-2.5 dark:bg-slate-800/50">
          <ShieldCheck className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            As alterações são salvas automaticamente na nuvem e sincronizadas via WebSockets para todos os colaboradores em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
