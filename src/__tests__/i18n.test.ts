import { describe, it, expect } from 'vitest';
import { formatMessage, translate, toLocale, STATIC_PAGES, LOCALES } from '../i18n';
import { ptBR } from '../i18n/locales/pt-BR';
import { enUS } from '../i18n/locales/en-US';
import { esES } from '../i18n/locales/es-ES';

const leaves = (tree: object, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`)
  );

describe('i18n', () => {
  it('interpolates params and leaves unknown placeholders as-is', () => {
    expect(formatMessage('en-US', 'Hello {name}', { name: 'Ana' })).toBe('Hello Ana');
    expect(formatMessage('en-US', 'Hello {name}')).toBe('Hello {name}');
  });

  it('picks plural forms per locale with formatted counts', () => {
    const msg = '{count, plural, one {# item} other {# itens}}';
    expect(formatMessage('pt-BR', msg, { count: 1 })).toBe('1 item');
    // CLDR: Portuguese uses "one" for 0 too, so messages that can be 0 add an =0 case
    expect(formatMessage('pt-BR', msg, { count: 0 })).toBe('0 item');
    expect(translate('pt-BR', 'folders.items', { count: 0 })).toBe('vazia');
    expect(formatMessage('pt-BR', msg, { count: 1200 })).toBe('1.200 itens');
    expect(formatMessage('en-US', '{count, plural, =0 {none} one {# file} other {# files}}', { count: 0 })).toBe('none');
    expect(translate('en-US', 'folders.items', { count: 2 })).toBe('2 items');
  });

  it('translates by key in each locale', () => {
    expect(translate('pt-BR', 'board.untitled')).toBe('Quadro sem título');
    expect(translate('en-US', 'board.untitled')).toBe('Untitled board');
    expect(translate('en-US', 'dashboard.movedToTrash', { title: 'Plan' })).toBe('“Plan” moved to the trash');
  });

  it('translates by key in Spanish', () => {
    expect(translate('es-ES', 'board.untitled')).toBe('Pizarra sin título');
    expect(translate('es-ES', 'folders.items', { count: 0 })).toBe('vacía');
    expect(translate('es-ES', 'folders.items', { count: 3 })).toBe('3 elementos');
  });

  it('maps language tags, including the legacy saved "en", to supported locales', () => {
    expect(toLocale('en')).toBe('en-US');
    expect(toLocale('en-GB')).toBe('en-US');
    expect(toLocale('es-MX')).toBe('es-ES');
    expect(toLocale('pt-PT')).toBe('pt-BR');
    expect(toLocale('fr')).toBeNull();
    expect(LOCALES.map((l) => l.id).sort()).toEqual(['en-US', 'es-ES', 'pt-BR']);
  });

  it('has a static page in every locale', () => {
    for (const urls of Object.values(STATIC_PAGES)) {
      expect(Object.keys(urls).sort()).toEqual(['en-US', 'es-ES', 'pt-BR']);
      expect(new Set(Object.values(urls)).size).toBe(3);
    }
  });

  for (const [name, dictionary] of [['English', enUS], ['Spanish', esES]] as const) {
    it(`has a ${name} translation for every key, with the same placeholders`, () => {
      const translations = new Map(leaves(dictionary));
      for (const [key, pt] of leaves(ptBR)) {
        const translated = translations.get(key);
        expect(translated, key).toBeTruthy();
        // Placeholders are {name} and the variable of {name, plural, ...}; option bodies are not
        const placeholders = (text: string) =>
          [...text.replace(/(=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\}/g, '').matchAll(/\{(\w+)[,}]/g)]
            .map((m) => m[1])
            .sort();
        expect(placeholders(translated!), key).toEqual(placeholders(pt));
      }
      expect(translations.size).toBe(leaves(ptBR).length);
    });
  }
});
