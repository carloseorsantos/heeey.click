import { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { HeeeyLogo } from './Logo';
import { Modal } from './Modal';
import { Button } from './ui/Button';
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
      icon={<HeeeyLogo className="w-10 h-10" />}
    >
      {success ? (
        <div className="text-center pt-2 space-y-4" role="status">
          <div className="w-14 h-14 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-label">{t('auth.checkEmail')}</h3>
            <p className="text-sm text-label-2 mt-1.5">
              {t('auth.sentBefore')} <strong className="font-semibold text-label">{email}</strong>
              {t('auth.sentAfter')}
            </p>
          </div>
          <Button size="lg" onClick={handleResetAndClose} className="w-full">
            {t('auth.done')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-label-2">{t('auth.optional')}</p>

          <div>
            <label htmlFor="email" className="block text-callout font-medium text-label mb-1.5">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-label-2 pointer-events-none" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                className="field h-11 pl-9"
                autoFocus
              />
            </div>
          </div>

          {error &&
            (isRateLimitError(error) ? (
              <div role="alert" className="flex items-start gap-2.5 p-3 rounded-xl bg-warning/10 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-warning" />
                <div>
                  <p className="font-semibold text-label">{t('auth.rateLimitTitle')}</p>
                  <p className="mt-0.5 text-label-2">{t('auth.rateLimitBody')}</p>
                </div>
              </div>
            ) : (
              <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 text-danger-text text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ))}

          <div className="space-y-2 pt-1">
            <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('auth.sending')}</span>
                </>
              ) : (
                <span>{t('auth.send')}</span>
              )}
            </Button>
            <Button variant="plain" size="lg" onClick={handleResetAndClose} className="w-full">
              {t('auth.continueAsGuest')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
