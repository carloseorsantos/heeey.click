import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Modal } from './Modal';
import { Avatar } from './Avatar';

const COLOR_OPTIONS = [
  { background: '#fee2e2', stroke: '#ef4444', label: 'Vermelho' },
  { background: '#ffedd5', stroke: '#f97316', label: 'Laranja' },
  { background: '#fef3c7', stroke: '#f59e0b', label: 'Âmbar' },
  { background: '#dcfce7', stroke: '#10b981', label: 'Verde' },
  { background: '#ccfbf1', stroke: '#14b8a6', label: 'Teal' },
  { background: '#cffafe', stroke: '#06b6d4', label: 'Ciano' },
  { background: '#e0e7ff', stroke: '#6366f1', label: 'Índigo' },
  { background: '#f3e8ff', stroke: '#a855f7', label: 'Roxo' },
  { background: '#fae8ff', stroke: '#d946ef', label: 'Fúcsia' },
  { background: '#fce7f3', stroke: '#ec4899', label: 'Rosa' },
];

interface NicknameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NicknameModal({ isOpen, onClose }: NicknameModalProps) {
  const { guestProfile, effectiveUserName, setNickname } = useAuth();
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
      title="Seu perfil"
      description="Como os outros te veem no quadro"
      icon={<Avatar name={name || '?'} color={selectedColor} className="w-11 h-11 text-sm" />}
    >
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label htmlFor="nickname" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Nome ou apelido
          </label>
          <input
            id="nickname"
            type="text"
            required
            maxLength={25}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-400 transition"
            placeholder="Digite seu nome"
            autoFocus
          />
        </div>

        <fieldset>
          <legend className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Cor do cursor e avatar
          </legend>
          <div className="grid grid-cols-5 gap-2.5">
            {COLOR_OPTIONS.map((c) => {
              const isSelected = selectedColor.stroke === c.stroke;
              return (
                <button
                  key={c.stroke}
                  type="button"
                  onClick={() => setSelectedColor({ background: c.background, stroke: c.stroke })}
                  className={`h-10 rounded-xl flex items-center justify-center transition-all ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${
                    isSelected ? 'ring-2 ring-slate-900 dark:ring-white scale-105' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.stroke }}
                  aria-label={c.label}
                  aria-pressed={isSelected}
                  title={c.label}
                >
                  {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/20 transition"
          >
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
