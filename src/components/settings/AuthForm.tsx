import { useEffect, useId, useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { isAuthApiError } from '@supabase/supabase-js';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { STATIC_PAGES, useI18n } from '../../i18n';

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

export type AuthMode = 'signup' | 'login';

/**
 * Magic-link sign-in, inline in Settings › Account and in the sign-up / sign-in dialogs.
 * "signup" creates the account, so it asks for the age and terms confirmation every time;
 * "login" never creates one, so it can skip it.
 */
export function AuthForm({ mode = 'signup' }: { mode?: AuthMode }) {
  const { signInWithMagicLink } = useAuth();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const emailId = useId();
  const consentId = useId();

  // Switching between the sign-up and sign-in dialogs keeps the email but starts the rest over,
  // so the age and terms confirmation is never carried into a sign-up
  useEffect(() => {
    setConsent(false);
    setError(null);
    setSuccess(false);
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError(t('auth.invalidEmail'));
      return;
    }
    if (mode === 'signup' && !consent) {
      setError(t('auth.consentRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    const { error: err } = await signInWithMagicLink(email.trim(), { createUser: mode === 'signup' });

    setLoading(false);
    if (err) {
      // Supabase's messages are in English; show ours, in the user's language
      if (err.message && isRateLimitError(err.message)) setError(err.message);
      // What Supabase answers when shouldCreateUser is false and the email has no account
      else if (mode === 'login' && isAuthApiError(err) && err.code === 'otp_disabled') setError(t('auth.noAccount'));
      else setError(t('auth.sendError'));
    } else {
      setSuccess(true);
    }
  }

  function handleReset() {
    setSuccess(false);
    setError(null);
  }

  return (
    <>
      {success ? (
        <div className="text-center pt-2 space-y-5" role="status">
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
          <Button variant="primary" size="lg" onClick={handleReset} className="w-full">
            {t('auth.useAnotherEmail')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor={emailId} className="block text-callout font-medium text-label mb-2">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-label-2 pointer-events-none" />
              <input
                id={emailId}
                type="email"
                required
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                className="field h-11 pl-9 bg-surface border-accent/60 shadow-[0_0_0_3.5px_rgb(var(--accent)/0.22)] aria-[invalid=true]:border-danger"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <label id={consentId} className="flex items-start gap-2.5 text-sm text-label-2">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-4 h-4 mt-0.5 flex-shrink-0 rounded accent-[rgb(var(--accent))]"
              />
              <span>
                {t('auth.consentBefore')}{' '}
                <a href={STATIC_PAGES.terms[locale]} target="_blank" rel="noopener" className="text-accent-text underline underline-offset-2">
                  {t('auth.terms')}
                </a>{' '}
                {t('auth.consentAnd')}{' '}
                <a href={STATIC_PAGES.privacy[locale]} target="_blank" rel="noopener" className="text-accent-text underline underline-offset-2">
                  {t('auth.privacy')}
                </a>
                .
              </span>
            </label>
          )}

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

          <div className="pt-1">
            <Button type="submit" variant="primary" size="lg" disabled={loading || (mode === 'signup' && !consent)}
              // Says why it is disabled: the age and terms confirmation is still unchecked
              aria-describedby={mode === 'signup' && !consent ? consentId : undefined}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('auth.sending')}</span>
                </>
              ) : (
                <span>{t('auth.send')}</span>
              )}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
