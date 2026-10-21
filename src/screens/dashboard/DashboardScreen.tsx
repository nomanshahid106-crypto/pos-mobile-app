import React from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Card, EmptyState, ErrorBox, Loading, Screen, StatCard, Sub, Title } from '@/components/ui';
import { dashboardService, salesService } from '@/services';
import { useSession } from '@/store/appStore';
import { formatMoney, toCents } from '@/lib/money';
import type { Sale } from '@/types/database.types';

interface Stats { today_sales: number; today_transactions: number; total_products: number; low_stock_count: number; week_sales: number; month_sales: number; }

export default function DashboardScreen() {
  const store = useSession((s) => s.store); const settings = useSession((s) => s.settings);
  const currency = settings?.currency ?? 'USD'; const storeId = store?.id ?? '';
  const stats = useQuery({ queryKey: ['dash', storeId], enabled: !!storeId, queryFn: () => dashboardService.stats(storeId) as unknown as Promise<Stats> });
  const recent = useQuery({ queryKey: ['recent', storeId], enabled: !!storeId, queryFn: () => dashboardService.recentSales(storeId) as unknown as Promise<Sale[]> });
  const best = useQuery({ queryKey: ['best', storeId], enabled: !!storeId, queryFn: () => salesService.bestSellers(storeId) });
  const refreshing = stats.isFetching || recent.isFetching;
  const refetch = () => { stats.refetch(); recent.refetch(); best.refetch(); };

  if (!storeId) return <Screen><EmptyState title="No store selected" hint="Create or join a store to see your dashboard." /></Screen>;
  if (stats.isLoading) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      <FlatList data={[]} renderItem={() => null} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
        ListHeaderComponent={<>
          <Title>{store?.name}</Title><Sub>Today at a glance — all figures from live sales records.</Sub>
          {!!stats.error && <ErrorBox message={(stats.error as Error).message} />}
          {stats.data && <>
            <View style={{ flexDirection: 'row' }}>
              <StatCard label="Today's sales" value={formatMoney(toCents(stats.data.today_sales), currency)} />
              <StatCard label="Transactions" value={String(stats.data.today_transactions)} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <StatCard label="Products" value={String(stats.data.total_products)} />
              <StatCard label="Low stock" value={String(stats.data.low_stock_count)} warn={stats.data.low_stock_count > 0} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <StatCard label="Last 7 days" value={formatMoney(toCents(stats.data.week_sales), currency)} />
              <StatCard label="This month" value={formatMoney(toCents(stats.data.month_sales), currency)} />
            </View>
          </>}
          <Card><Text style={{ fontWeight: '700', marginBottom: 6 }}>Best sellers (30 days)</Text>
            {best.data?.length ? best.data.map((b) => <View key={b.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}><Text>{b.name}</Text><Text>{b.qty} sold</Text></View>)
              : <Sub>No sales yet in the last 30 days.</Sub>}
          </Card>
          <Text style={{ fontWeight: '700', fontSize: 17, marginTop: 12, marginBottom: 4 }}>Recent transactions</Text>
          {recent.data?.length ? recent.data.map((s) => (
            <TouchableOpacity key={s.id} onPress={() => router.push(`/(tabs)/sales/${s.id}`)}>
              <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '600' }}>{s.receipt_number}</Text><Text>{formatMoney(toCents(s.total), currency)}</Text></View><Sub>{new Date(s.created_at).toLocaleString()} · {s.status}</Sub></Card>
            </TouchableOpacity>))
            : <EmptyState title="No transactions yet" hint="Completed sales will appear here." />}
        </>} />
    </Screen>
  );
}
