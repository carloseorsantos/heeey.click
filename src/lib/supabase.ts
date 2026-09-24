import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nsczplggnyuljosvvlml.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DcFYEb25HZ7S7qym6K8TxA_ismhm5Sv';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Variáveis do Supabase (VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY) não foram encontradas.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

// Boards are shared by link: RLS only returns a board to its owner or to requests that
// name it in this header (supabase/migrations/20260923210000_board_link_access.sql).
// Every query on a board someone else may own must set it.
export const BOARD_ID_HEADER = 'x-board-id';
