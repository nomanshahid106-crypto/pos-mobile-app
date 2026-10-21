import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authService, settingsService } from '@/services';
import { useSession } from '@/store/appStore';
import type { Store, StoreMember, StoreSettings } from '@/types/database.types';

/** Loads auth session -> first store membership -> settings. Returns readiness. */
export function useSessionBootstrap() {
  const [ready, setReady] = useState(false);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const setSession = useSession((s) => s.setSession);
  const clear = useSession((s) => s.clear);

  useEffect(() => {
    let mounted = true;
    async function load(userId: string, email?: string) {
      try {
        const rows = await authService.myStores() as unknown as (StoreMember & { stores: Store })[];
        const first = rows?.[0];
        if (!mounted) return;
        if (first?.stores) {
          const settings = await settingsService.get(first.stores.id).catch(() => null);
          setSession({ userId, email: email ?? null, store: first.stores, role: first.role, settings: settings as StoreSettings | null });
          setHasStore(true);
        } else { setSession({ userId, email: email ?? null }); setHasStore(false); }
      } catch { if (mounted) setHasStore(false); }
      if (mounted) setReady(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u) load(u.id, u.email); else { clear(); setHasStore(null); setReady(true); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      if (u) load(u.id, u.email); else { clear(); setHasStore(null); setReady(true); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return { ready, hasStore };
}
