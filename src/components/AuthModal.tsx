import { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, X, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { HeeeyLogo } from './Logo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Por favor, digite um e-mail válido.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: err } = await signInWithMagicLink(email.trim());

    setLoading(false);
    if (err) {
      setError(err.message || 'Erro ao enviar o link mágico. Tente novamente.');
    } else {
      setSuccess(true);
    }
  }

  function handleResetAndClose() {
    setEmail('');
    setSuccess(false);
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleResetAndClose}
          className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-500 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <HeeeyLogo className="w-11 h-11 shadow-lg shadow-violet-500/30" />
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Acessar sua conta</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Entre sem senha via Magic Link</p>
          </div>
        </div>

        {/* Optional Auth Notice */}
        <div className="mb-5 p-3 bg-violet-50/70 dark:bg-violet-950/30 rounded-xl border border-violet-100 dark:border-violet-900/50 text-xs text-violet-950 dark:text-violet-200 flex items-start space-x-2.5">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">O login é 100% opcional:</span> Você e seus amigos podem desenhar livremente no Modo Convidado. O link mágico serve apenas para salvar seus quadros na sua conta.
          </div>
        </div>

        {success ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Link mágico enviado!</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                Enviamos um link de login para <strong className="text-violet-600 dark:text-violet-400">{email}</strong>.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Abra seu e-mail e clique no link para autenticar instantaneamente neste navegador.
              </p>
            </div>
            <button
              onClick={handleResetAndClose}
              className="mt-4 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Concluído
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Seu endereço de e-mail
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800 transition"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              (error.toLowerCase().includes('rate limit') ||
              error.toLowerCase().includes('over_email_send_rate_limit') ||
              error.toLowerCase().includes('too many requests') ||
              error.toLowerCase().includes('security purposes') ||
              error.toLowerCase().includes('429') ||
              error.toLowerCase().includes('email_rate_limit') ||
              error.toLowerCase().includes('muitas requisições')) ? (
                <div className="space-y-3 bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl dark:bg-amber-950/30 dark:border-amber-800/50">
                  <div className="flex items-start space-x-2.5 text-amber-800 dark:text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        Limite temporário de envio de e-mails
                      </p>
                      <p className="mt-1 text-amber-700 dark:text-amber-300/90 leading-relaxed">
                        Para evitar abusos no plano gratuito, o envio de links mágicos tem cota limitada. Não se preocupe: você não precisa de conta para usar o Heeey! Continue como convidado.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                  >
                    Continuar como Convidado
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-rose-600 bg-rose-50 p-3 rounded-xl text-xs dark:bg-rose-950/40 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-violet-600/25 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando link...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Enviar Magic Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Prefiro continuar sem conta (Modo Convidado)
            </button>

            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 pt-1">
              Seus quadros serão automaticamente associados e sincronizados com a sua conta.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
