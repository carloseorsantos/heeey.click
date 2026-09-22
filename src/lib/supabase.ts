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
