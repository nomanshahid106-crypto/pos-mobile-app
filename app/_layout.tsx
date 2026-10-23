import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import { useSession } from '@/store/appStore';
import { Loading } from '@/components/ui';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });

function Gate() {
  const { ready, hasStore } = useSessionBootstrap();
  const userId = useSession((s) => s.userId);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!userId && !inAuth) router.replace('/(auth)/login');
    else if (userId && hasStore === false && (segments as string[])[1] !== 'create-store') router.replace('/(auth)/create-store');
    else if (userId && hasStore && inAuth) router.replace('/(tabs)');
  }, [ready, userId, hasStore, segments]);
  if (!ready) return <Loading />;
  return <Slot />;
}
export default function RootLayout() {
  return <QueryClientProvider client={queryClient}><Gate /></QueryClientProvider>;
}
