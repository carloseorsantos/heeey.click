import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { isNewAccount } from '../lib/analytics';

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
