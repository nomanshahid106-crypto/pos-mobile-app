import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import { useSession } from '@/store/appStore';
import { AnimatedSplash } from '@/components/AnimatedSplash';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });

function Gate() {
  const { ready, hasStore } = useSessionBootstrap();
  const userId = useSession((s) => s.userId);
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);
  const onSplashDone = useCallback(() => setSplashDone(true), []);
  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!userId && !inAuth) router.replace('/(auth)/login');
    else if (userId && hasStore === false && (segments as string[])[1] !== 'create-store') router.replace('/(auth)/create-store');
    else if (userId && hasStore && inAuth) router.replace('/(tabs)');
  }, [ready, userId, hasStore, segments]);
  return (
    <View style={{ flex: 1, backgroundColor: '#0A2540' }}>
      {ready ? <Slot /> : <View style={{ flex: 1 }} />}
      {!splashDone && <AnimatedSplash ready={ready} onDone={onSplashDone} />}
    </View>
  );
}
export default function RootLayout() {
  return <QueryClientProvider client={queryClient}><Gate /></QueryClientProvider>;
}
