import { useState, useEffect } from 'react';
import { X, Check, UserCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800"
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
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md transition-colors"
            style={{ backgroundColor: selectedColor.stroke }}
          >
            <UserCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Seu Perfil de Colaborador</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Como outros te veem no quadro</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Seu nome ou apelido
            </label>
            <input
              type="text"
              required
              maxLength={25}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800 transition"
              placeholder="Digite seu nome"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Cor do cursor e avatar
            </label>
            <div className="grid grid-cols-5 gap-2.5">
              {COLOR_OPTIONS.map((c, i) => {
                const isSelected = selectedColor.stroke === c.stroke;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedColor({ background: c.background, stroke: c.stroke })}
                    className={`h-9 rounded-xl flex items-center justify-center transition-all ${
                      isSelected ? 'ring-2 ring-offset-2 ring-slate-800 scale-105' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.stroke }}
                    title={c.label}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition dark:bg-slate-800 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-600/20 transition"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
