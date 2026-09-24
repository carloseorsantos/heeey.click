/**
 * Minimal, typed i18n. Messages are plain strings with {placeholders} and an
 * ICU-like plural form: "{count, plural, one {# item} other {# itens}}".
 * Keys are checked by TypeScript against the pt-BR dictionary.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ptBR, type Messages } from './locales/pt-BR';
import { enUS } from './locales/en-US';
import { esES } from './locales/es-ES';

export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export const LOCALES: { id: Locale; label: string; excalidrawLangCode: string }[] = [
  { id: 'pt-BR', label: 'Português', excalidrawLangCode: 'pt-BR' },
  { id: 'en-US', label: 'English', excalidrawLangCode: 'en' },
  { id: 'es-ES', label: 'Español', excalidrawLangCode: 'es-ES' },
];

const DICTIONARIES: Record<Locale, Messages> = { 'pt-BR': ptBR, 'en-US': enUS, 'es-ES': esES };
// Shared with the static landing pages, which read it to open in the visitor's chosen language
const STORAGE_KEY = 'heeey_locale';

/** The static pages (landing, legal, MCP) are separate HTML files per language */
export type StaticPage = 'home' | 'terms' | 'privacy' | 'mcp';

export const STATIC_PAGES: Record<StaticPage, Record<Locale, string>> = {
  home: { 'pt-BR': '/', 'en-US': '/en', 'es-ES': '/es' },
  terms: { 'pt-BR': '/termos', 'en-US': '/en/terms', 'es-ES': '/es/terminos' },
  privacy: { 'pt-BR': '/privacidade', 'en-US': '/en/privacy', 'es-ES': '/es/privacidad' },
  mcp: { 'pt-BR': '/pt-br/mcp', 'en-US': '/mcp', 'es-ES': '/es/mcp' },
};

/** Maps a language tag ("en", "es-MX", "pt-BR", the legacy saved "en") to a supported locale */
export function toLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  if (/^pt\b/i.test(tag)) return 'pt-BR';
  if (/^en\b/i.test(tag)) return 'en-US';
  if (/^es\b/i.test(tag)) return 'es-ES';
  return null;
}

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type MessageParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function detectLocale(): Locale {
  // ?lang= comes from links on the static pages (/en, /es), so the app opens in the page's language
  const fromUrl = typeof location !== 'undefined' ? toLocale(new URLSearchParams(location.search).get('lang')) : null;
  try {
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = toLocale(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    // Storage unavailable: fall back to the browser language
  }
  if (fromUrl) return fromUrl;
  const languages = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const language of languages) {
    const locale = toLocale(language);
    if (locale) return locale;
  }
  return 'pt-BR';
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function formatMessage(locale: Locale, template: string, params: MessageParams = {}): string {
  const plural = new Intl.PluralRules(locale);
  const withPlurals = template.replace(
    /\{(\w+), plural,((?:\s*(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\})+)\s*\}/g,
    (_match, name: string, body: string) => {
      const value = Number(params[name] ?? 0);
      const options = new Map<string, string>();
      for (const [, selector, text] of body.matchAll(/(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g)) {
        options.set(selector, text);
      }
      const chosen = options.get(`=${value}`) ?? options.get(plural.select(value)) ?? options.get('other') ?? '';
      return chosen.replace(/#/g, new Intl.NumberFormat(locale).format(value));
    }
  );
  return withPlurals.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name])
  );
}

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = lookup(DICTIONARIES[locale], key) ?? lookup(ptBR, key) ?? key;
  return formatMessage(locale, template, params);
}

// Current locale for code outside React (date formatting, defaults)
let currentLocale: Locale = typeof window !== 'undefined' ? detectLocale() : 'pt-BR';

export function getLocale(): Locale {
  return currentLocale;
}

/** Translate with the current locale, for code outside React components */
export const t: Translate = (key, params) => translate(currentLocale, key, params);

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  excalidrawLangCode: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(currentLocale);

  const setLocale = useCallback((next: Locale) => {
    currentLocale = next;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted in private mode; the choice lasts for this visit
    }
  }, []);

  // Drop ?lang= once read (see detectLocale) so it doesn't stick to shared links
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('lang')) return;
    url.searchParams.delete('lang');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  useEffect(() => {
    currentLocale = locale;
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      excalidrawLangCode: LOCALES.find((l) => l.id === locale)?.excalidrawLangCode ?? 'en',
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
