import { describe, it, expect } from 'vitest';
import {
  normalizeForSearch,
  getSearchTerms,
  extractBoardText,
  buildSnippet,
  searchLoadedBoards,
} from '../lib/search';
import { Board } from '../lib/types';

const board = (id: string, title: string, texts: string[] = [], extra: Partial<Board> = {}): Board => ({
  id,
  title,
  owner_id: null,
  access_level: 'edit',
  created_at: '',
  updated_at: '',
  app_state: {},
  files: {},
  elements: texts.map((text, i) => ({ id: `${id}-${i}`, type: 'text', text, isDeleted: false })),
  ...extra,
});

describe('search helpers', () => {
  it('normalizes accents and case', () => {
    expect(normalizeForSearch('Reunião ÁGIL')).toBe('reuniao agil');
    expect(getSearchTerms('  Orçamento   Q4 ')).toEqual(['orcamento', 'q4']);
  });

  it('extracts only visible text elements', () => {
    const elements = [
      { type: 'text', text: 'Olá' },
      { type: 'text', text: 'apagado', isDeleted: true },
      { type: 'rectangle' },
      { type: 'text', text: '  ' },
      { type: 'text', text: 'mundo' },
    ];
    expect(extractBoardText(elements)).toBe('Olá · mundo');
  });

  it('buildSnippet keeps original accents around an accent-insensitive match', () => {
    const snippet = buildSnippet('Pauta da reunião de planejamento do trimestre', ['reuniao'], 8);
    expect(snippet).toEqual({ before: 'Pauta da ', match: 'reunião', after: ' de planejamento…' });
  });

  it('buildSnippet returns undefined when nothing matches', () => {
    expect(buildSnippet('abc', ['xyz'])).toBeUndefined();
    expect(buildSnippet('', ['a'])).toBeUndefined();
  });

  it('searchLoadedBoards matches titles and canvas text, requiring every term', () => {
    const boards = [
      board('1', 'Roadmap', ['Lançamento em março']),
      board('2', 'Reunião semanal', []),
      board('3', 'Outro', ['nada aqui']),
      board('4', 'Resumo', ['lancamento'], { contentLoaded: false }),
    ];
    const hits = searchLoadedBoards(boards, 'lancamento marco');
    expect(hits.map((h) => h.board.id)).toEqual(['1']);
    expect(hits[0].snippet?.match).toBe('Lançamento');

    const titleHits = searchLoadedBoards(boards, 'reuniao');
    expect(titleHits.map((h) => h.board.id)).toEqual(['2']);
    expect(titleHits[0].snippet).toBeUndefined();
  });
});
