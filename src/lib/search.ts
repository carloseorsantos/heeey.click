import { supabase } from './supabase';
import { Board } from './types';

export interface BoardSnippet {
  before: string;
  match: string;
  after: string;
}

export interface BoardSearchHit {
  board: Board;
  snippet?: BoardSnippet;
}

/** Lowercase and strip accents so "Reunião" matches "reuniao" */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function getSearchTerms(query: string): string[] {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

/** Visible text on the canvas (text elements, including shape labels) */
export function extractBoardText(elements: readonly any[] | null | undefined): string {
  return (elements || [])
    .filter((el) => el && el.type === 'text' && !el.isDeleted && typeof el.text === 'string')
    .map((el) => el.text.trim())
    .filter(Boolean)
    .join(' · ');
}

export function textMatchesTerms(text: string, terms: readonly string[]): boolean {
  if (terms.length === 0) return false;
  const normalized = normalizeForSearch(text);
  return terms.every((term) => normalized.includes(term));
}

/**
 * Cuts a short excerpt around the first matching term, keeping the original accents.
 * Matching is accent-insensitive: each original character is mapped to its normalized form.
 */
export function buildSnippet(text: string, terms: readonly string[], radius = 40): BoardSnippet | undefined {
  if (!text || terms.length === 0) return undefined;

  const chars = Array.from(text.replace(/\s+/g, ' '));
  let normalized = '';
  const originalIndex: number[] = [];
  chars.forEach((char, i) => {
    for (const n of normalizeForSearch(char)) {
      normalized += n;
      originalIndex.push(i);
    }
  });

  let best: { start: number; length: number } | undefined;
  for (const term of terms) {
    const at = normalized.indexOf(term);
    if (at !== -1 && (!best || at < best.start)) best = { start: at, length: term.length };
  }
  if (!best) return undefined;

  const matchStart = originalIndex[best.start];
  const matchEnd = originalIndex[best.start + best.length - 1] + 1;
  // Widen to whole words (up to 15 extra characters) so the excerpt does not start mid-word
  let from = Math.max(0, matchStart - radius);
  for (let n = 0; from > 0 && chars[from - 1] !== ' ' && n < 15; n++) from--;
  let to = Math.min(chars.length, matchEnd + radius);
  for (let n = 0; to < chars.length && chars[to] !== ' ' && n < 15; n++) to++;

  return {
    before: (from > 0 ? '…' : '') + chars.slice(from, matchStart).join(''),
    match: chars.slice(matchStart, matchEnd).join(''),
    after: chars.slice(matchEnd, to).join('') + (to < chars.length ? '…' : ''),
  };
}

/** Title or canvas text search over boards whose scene is available locally */
export function searchLoadedBoards(boards: readonly Board[], query: string): BoardSearchHit[] {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return [];
  const hits: BoardSearchHit[] = [];
  for (const board of boards) {
    const content = board.contentLoaded === false ? '' : extractBoardText(board.elements);
    const titleMatch = textMatchesTerms(board.title || '', terms);
    const contentMatch = content ? textMatchesTerms(`${board.title} ${content}`, terms) : false;
    if (titleMatch || contentMatch) {
      hits.push({ board, snippet: titleMatch && !contentMatch ? undefined : buildSnippet(content, terms) });
    }
  }
  return hits;
}

/**
 * Server-side fulltext search over the signed-in user's boards (title + canvas text).
 * Returns null when unavailable (e.g. database without the search migration).
 */
export async function searchBoardsRemote(query: string, limit = 20): Promise<BoardSearchHit[] | null> {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return [];
  const { data, error } = await supabase.rpc('search_boards', { p_query: query, p_limit: limit });
  if (error) {
    console.warn('Busca no conteúdo indisponível:', error.message);
    return null;
  }
  return ((data || []) as any[]).map(({ content, rank: _rank, ...row }) => ({
    board: { ...row, elements: [], app_state: {}, files: {}, contentLoaded: false } as Board,
    snippet: buildSnippet(content || '', terms),
  }));
}
