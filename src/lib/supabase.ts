import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
// Domain types live in @/types/database.types and are enforced in the service
// layer (src/services). The client itself is intentionally untyped: hand-written
// Database generics drift from `supabase gen types` output. Regenerate real
// types with the CLI (see types file header) and pass them here when ready.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  // Fail loudly in dev rather than silently using mock data.
  console.warn('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env');
}
export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
/** Single place that turns Supabase errors into user-readable messages. */
export function friendlyError(error: unknown): string {
  const msg = (error as { message?: string })?.message ?? 'Something went wrong';
  if (/Insufficient stock/i.test(msg)) return msg;
  if (/Discount exceeds/i.test(msg)) return 'That discount exceeds your authorized limit.';
  if (/Not a member/i.test(msg)) return 'You do not have access to this store.';
  if (/Invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  return msg;
}
