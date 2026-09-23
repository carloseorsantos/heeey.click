import { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { HeeeyLogo } from './Logo';
import { Modal } from './Modal';
import { useI18n } from '../i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RATE_LIMIT_MARKERS = [
  'rate limit',
  'over_email_send_rate_limit',
  'too many requests',
  'security purposes',
  '429',
  'email_rate_limit',
  'muitas requisições',
];

function isRateLimitError(message: string) {
  const lower = message.toLowerCase();
  return RATE_LIMIT_MARKERS.some((marker) => lower.includes(marker));
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithMagicLink } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError(t('auth.invalidEmail'));
      return;
    }

    setLoading(true);
    setError(null);

    const { error: err } = await signInWithMagicLink(email.trim());

    setLoading(false);
    if (err) {
      setError(err.message || t('auth.sendError'));
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
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title={t('auth.title')}
      description={t('auth.description')}
      icon={<HeeeyLogo className="w-11 h-11 shadow-lg shadow-brand-500/30" />}
    >
      {success ? (
        <div className="text-center py-2 space-y-4" role="status">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Confira seu e-mail</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              {t('auth.sentBefore')}{' '}
              <strong className="text-brand-700 dark:text-brand-300">{email}</strong>
              {t('auth.sentAfter')}
            </p>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t('auth.done')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('auth.optional')}
          </p>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-400 transition"
                autoFocus
              />
            </div>
          </div>

          {error &&
            (isRateLimitError(error) ? (
              <div
                role="alert"
                className="space-y-3 bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl dark:bg-amber-950/30 dark:border-amber-800/50"
              >
                <div className="flex items-start gap-2.5 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      {t('auth.rateLimitTitle')}
                    </p>
                    <p className="mt-1 text-amber-800 dark:text-amber-300/90 leading-relaxed">
                      {t('auth.rateLimitBody')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                role="alert"
                className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-xl text-sm dark:bg-rose-950/40 dark:text-rose-300"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/25 transition disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('auth.sending')}</span>
              </>
            ) : (
              <span>{t('auth.send')}</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-full py-2.5 px-4 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
          >
            {t('auth.continueAsGuest')}
          </button>
        </form>
      )}
    </Modal>
  );
}
