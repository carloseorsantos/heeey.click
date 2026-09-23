/**
 * Minimal, typed i18n. Messages are plain strings with {placeholders} and an
 * ICU-like plural form: "{count, plural, one {# item} other {# itens}}".
 * Keys are checked by TypeScript against the pt-BR dictionary.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ptBR, type Messages } from './locales/pt-BR';
import { en } from './locales/en';

export type Locale = 'pt-BR' | 'en';

export const LOCALES: { id: Locale; label: string; excalidrawLangCode: string }[] = [
  { id: 'pt-BR', label: 'Português', excalidrawLangCode: 'pt-BR' },
  { id: 'en', label: 'English', excalidrawLangCode: 'en' },
];

const DICTIONARIES: Record<Locale, Messages> = { 'pt-BR': ptBR, en };
const STORAGE_KEY = 'heeey_locale';

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type MessageParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pt-BR' || saved === 'en') return saved;
  } catch {
    // Storage unavailable: fall back to the browser language
  }
  const languages = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const language of languages) {
    if (/^pt\b/i.test(language)) return 'pt-BR';
    if (/^en\b/i.test(language)) return 'en';
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
