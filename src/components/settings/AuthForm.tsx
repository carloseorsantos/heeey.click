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

/** Google's "G", in its brand colors (Google asks for the official mark on sign-in buttons) */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Magic-link and Google sign-in, inline in Settings › Account and in the sign-up / sign-in dialogs.
 * "signup" creates the account, so it asks for the age and terms confirmation every time;
 * "login" never creates one by email, so it can skip it. Google always creates the account when
 * there is none, so in "login" it states the same terms next to its button.
 */
export function AuthForm({ mode = 'signup', onSwitchMode }: { mode?: AuthMode; onSwitchMode?: () => void }) {
  const { signInWithMagicLink, signInWithGoogle } = useAuth();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  async function handleGoogle() {
    if (mode === 'signup' && !consent) {
      setError(t('auth.consentRequired'));
      return;
    }
    setGoogleLoading(true);
    setError(null);
    // On success the browser is already on its way to Google, so the spinner stays until it leaves
    const { error: err } = await signInWithGoogle();
    if (err) {
      setGoogleLoading(false);
      setError(t('auth.googleError'));
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
            <Button type="submit" variant="primary" size="lg" disabled={loading || googleLoading || (mode === 'signup' && !consent)}
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

          <div className="flex items-center gap-3 text-xs text-label-3" aria-hidden="true">
            <span className="h-px flex-1 bg-separator" />
            {t('auth.orDivider')}
            <span className="h-px flex-1 bg-separator" />
          </div>

          <div className="space-y-2.5">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleGoogle}
              disabled={loading || googleLoading || (mode === 'signup' && !consent)}
              aria-describedby={mode === 'signup' && !consent ? consentId : undefined}
              className="w-full"
            >
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleMark />}
              <span>{t('auth.google')}</span>
            </Button>
            {mode === 'login' && (
              <p className="text-xs text-label-2 text-center">
                {t('auth.googleConsentBefore')}{' '}
                <a href={STATIC_PAGES.terms[locale]} target="_blank" rel="noopener" className="text-accent-text underline underline-offset-2">
                  {t('auth.terms')}
                </a>{' '}
                {t('auth.consentAnd')}{' '}
                <a href={STATIC_PAGES.privacy[locale]} target="_blank" rel="noopener" className="text-accent-text underline underline-offset-2">
                  {t('auth.privacy')}
                </a>
                .
              </p>
            )}
          </div>

          {/* Hidden once the link is sent, and locked while sending so a late answer
              never lands in the other dialog */}
          {onSwitchMode && (
            <p className="text-center text-sm text-label-2">
              {mode === 'login' ? t('auth.noAccountYet') : t('auth.haveAccount')}{' '}
              <button
                type="button"
                onClick={onSwitchMode}
                disabled={loading || googleLoading}
                className="font-medium text-accent-text underline-offset-2 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {mode === 'login' ? t('auth.createAccount') : t('dashboard.signIn')}
              </button>
            </p>
          )}
        </form>
      )}
    </>
  );
}
