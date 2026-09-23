import { describe, it, expect } from 'vitest';
import { formatMessage, translate } from '../i18n';
import { ptBR } from '../i18n/locales/pt-BR';
import { en } from '../i18n/locales/en';

const leaves = (tree: object, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`)
  );

describe('i18n', () => {
  it('interpolates params and leaves unknown placeholders as-is', () => {
    expect(formatMessage('en', 'Hello {name}', { name: 'Ana' })).toBe('Hello Ana');
    expect(formatMessage('en', 'Hello {name}')).toBe('Hello {name}');
  });

  it('picks plural forms per locale with formatted counts', () => {
    const msg = '{count, plural, one {# item} other {# itens}}';
    expect(formatMessage('pt-BR', msg, { count: 1 })).toBe('1 item');
    // CLDR: Portuguese uses "one" for 0 too, so messages that can be 0 add an =0 case
    expect(formatMessage('pt-BR', msg, { count: 0 })).toBe('0 item');
    expect(translate('pt-BR', 'folders.items', { count: 0 })).toBe('vazia');
    expect(formatMessage('pt-BR', msg, { count: 1200 })).toBe('1.200 itens');
    expect(formatMessage('en', '{count, plural, =0 {none} one {# file} other {# files}}', { count: 0 })).toBe('none');
    expect(translate('en', 'folders.items', { count: 2 })).toBe('2 items');
  });

  it('translates by key in each locale', () => {
    expect(translate('pt-BR', 'board.untitled')).toBe('Quadro sem título');
    expect(translate('en', 'board.untitled')).toBe('Untitled board');
    expect(translate('en', 'dashboard.movedToTrash', { title: 'Plan' })).toBe('“Plan” moved to the trash');
  });

  it('has an English translation for every key, with the same placeholders', () => {
    const english = new Map(leaves(en));
    for (const [key, pt] of leaves(ptBR)) {
      const translated = english.get(key);
      expect(translated, key).toBeTruthy();
      // Placeholders are {name} and the variable of {name, plural, ...}; option bodies are not
      const placeholders = (text: string) =>
        [...text.replace(/(=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\}/g, '').matchAll(/\{(\w+)[,}]/g)]
          .map((m) => m[1])
          .sort();
      expect(placeholders(translated!), key).toEqual(placeholders(pt));
    }
    expect(english.size).toBe(leaves(ptBR).length);
  });
});
