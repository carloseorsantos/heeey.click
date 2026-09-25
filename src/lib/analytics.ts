import type { PostHog } from 'posthog-js';
import type { User } from '@supabase/supabase-js';
import type { BeforeSendEvent } from '@vercel/analytics';

// Analytics is opt-in per deploy: without VITE_POSTHOG_KEY nothing is loaded.
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

// A login counts as a signup when the account was created moments before it signed in
const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

let client: Promise<PostHog | null> | null = null;

function getClient(): Promise<PostHog | null> {
  if (!KEY || typeof window === 'undefined') return Promise.resolve(null);
  if (!client) {
    // Loaded lazily so the SDK stays out of the main bundle
    client = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(KEY, {
          api_host: HOST,
          capture_pageview: 'history_change',
          autocapture: false,
          disable_session_recording: true,
          disable_surveys: true,
          persistence: 'localStorage',
          person_profiles: 'identified_only',
        });
        return posthog;
      })
      .catch((err) => {
        console.warn('Analytics indisponível:', err);
        return null;
      });
  }
  return client;
}

// A board link grants access to the board and the magic-link callback carries auth tokens,
// so Vercel only ever sees the route shape (`/b/[id]`) and utm_* params, never ids or tokens.
export function redactUrl(href: string): string {
  const url = new URL(href);
  url.pathname = url.pathname.replace(/^\/b\/[^/]+/, '/b/[id]');
  for (const key of [...url.searchParams.keys()]) {
    if (!key.startsWith('utm_')) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString();
}

export function redactEvent(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: redactUrl(event.url) };
}

export function initAnalytics() {
  void getClient();
  // Vercel Web Analytics is now initialized via the <Analytics /> component in App.tsx
  // This function kept for PostHog initialization
}

export function track(event: string, properties?: Record<string, unknown>) {
  void getClient().then((ph) => ph?.capture(event, properties));
}

export function isNewAccount(user: User, now = Date.now()): boolean {
  const created = Date.parse(user.created_at);
  return Number.isFinite(created) && now - created < NEW_ACCOUNT_WINDOW_MS;
}

// Called on SIGNED_IN. Identifies by id only (never email) and fires
// `signup_completed` once per account, the SEO loop's conversion event.
export function trackSignIn(user: User) {
  void getClient().then((ph) => {
    if (!ph) return;
    ph.identify(user.id);
    if (!isNewAccount(user)) return;
    const flag = `heeey_signup_tracked_${user.id}`;
    try {
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, '1');
    } catch {}
    ph.capture('signup_completed', { method: user.app_metadata?.provider === 'google' ? 'google' : 'magic_link' });
  });
}

export function resetAnalytics() {
  void getClient().then((ph) => ph?.reset());
}
