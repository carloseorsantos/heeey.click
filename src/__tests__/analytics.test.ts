import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { isNewAccount, redactUrl } from '../lib/analytics';

const userCreatedAt = (iso: string) => ({ id: 'u1', created_at: iso }) as User;
const now = Date.parse('2026-09-23T12:00:00Z');

describe('isNewAccount', () => {
  it('treats an account created minutes ago as a signup', () => {
    expect(isNewAccount(userCreatedAt('2026-09-23T11:58:00Z'), now)).toBe(true);
  });

  it('treats an older account as a returning login', () => {
    expect(isNewAccount(userCreatedAt('2026-09-20T12:00:00Z'), now)).toBe(false);
  });

  it('ignores a missing or invalid created_at', () => {
    expect(isNewAccount(userCreatedAt(''), now)).toBe(false);
  });
});

describe('redactUrl', () => {
  it('hides the board id, since the link grants access', () => {
    expect(redactUrl('https://heeey.click/b/e67e3a1e-8e89-4089-a5f1-382a39281a92')).toBe('https://heeey.click/b/[id]');
  });

  it('drops auth tokens from the query and hash but keeps utm params', () => {
    expect(redactUrl('https://heeey.click/app?code=secret&utm_source=x#access_token=secret')).toBe(
      'https://heeey.click/app?utm_source=x',
    );
  });

  it('leaves other pages untouched', () => {
    expect(redactUrl('https://heeey.click/docs/features')).toBe('https://heeey.click/docs/features');
  });
});
