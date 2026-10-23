import React from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT, EmptyState, ErrorBox, Loading, Screen, Sub, TopBar, useC, type Palette } from '@/components/ui';
import { categoryService, dashboardService, productService, salesService } from '@/services';
import { useSession } from '@/store/appStore';
import { formatMoney, toCents } from '@/lib/money';
import type { Sale } from '@/types/database.types';

interface Stats { today_sales: number; today_transactions: number; total_products: number; low_stock_count: number; week_sales: number; month_sales: number; }

function StatBox({ c, label, value, sub, icon, subColor }: { c: Palette; label: string; value: string; sub: string; icon: React.ReactNode; subColor?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, margin: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, color: c.sub, flex: 1 }}>{label}</Text>
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#E8F4FB', alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      </View>
      <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, marginTop: 8 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: subColor ?? c.sub, marginTop: 5 }}>{sub}</Text>
    </View>
  );
}

function statusStyle(status: string, c: Palette) {
  if (status === 'completed') return { bg: '#E7F8EE', fg: '#12805C', dot: '#22C55E', label: 'completed' };
  if (status === 'refunded') return { bg: '#FDECEC', fg: '#B42318', dot: '#EF4444', label: 'refunded' };
  return { bg: '#FEF6E0', fg: '#9A6B00', dot: '#F59E0B', label: status.replace('_', ' ') };
}

export default function DashboardScreen() {
  const c = useC();
  const store = useSession((s) => s.store); const settings = useSession((s) => s.settings);
  const currency = settings?.currency ?? 'USD'; const storeId = store?.id ?? '';
  const stats = useQuery({ queryKey: ['dash', storeId], enabled: !!storeId, queryFn: () => dashboardService.stats(storeId) as unknown as Promise<Stats> });
  const recent = useQuery({ queryKey: ['recent', storeId], enabled: !!storeId, queryFn: () => dashboardService.recentSales(storeId) as unknown as Promise<Sale[]> });
  const best = useQuery({ queryKey: ['best', storeId], enabled: !!storeId, queryFn: () => salesService.bestSellers(storeId) });
  const products = useQuery({ queryKey: ['products', storeId], enabled: !!storeId, queryFn: () => productService.list(storeId, {}) });
  const cats = useQuery({ queryKey: ['cats', storeId], enabled: !!storeId, queryFn: () => categoryService.list(storeId) });
  const refreshing = stats.isFetching || recent.isFetching;
  const refetch = () => { stats.refetch(); recent.refetch(); best.refetch(); products.refetch(); };
  const prodByName = new Map((products.data ?? []).map((p) => [p.name, p]));
  const catName = (id: string | null) => (cats.data ?? []).find((x) => x.id === id)?.name ?? '';

  if (!storeId) return <Screen><EmptyState title="No store selected" hint="Create or join a store to see your dashboard." /></Screen>;
  if (stats.isLoading) return <Screen><TopBar title="Dashboard" icon="view-dashboard-outline" /><Loading /></Screen>;
  const d = stats.data;
  return (
    <Screen>
      <TopBar title="Dashboard" icon="view-dashboard-outline" />
      <FlatList data={[]} renderItem={() => null} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
        ListHeaderComponent={<>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8F4FB', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: ACCENT }}>{(store?.name ?? 'S').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', color: c.text, marginLeft: 10 }}>{store?.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7F8EE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 9 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 5 }} />
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#12805C' }}>Live POS</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12.5, color: c.sub, marginTop: 8 }}>Today at a glance — all figures from live sales records.</Text>
          {!!stats.error && <ErrorBox message={(stats.error as Error).message} />}
          {d && <>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <StatBox c={c} label="TODAY'S SALES" value={formatMoney(toCents(d.today_sales), currency)} sub={d.today_sales > 0 ? `${d.today_transactions} orders closed` : '— Awaiting first sale'} icon={<MaterialCommunityIcons name="wallet-outline" size={16} color={ACCENT} />} />
              <StatBox c={c} label="TRANSACTIONS" value={String(d.today_transactions)} sub="◷ Register open" icon={<MaterialCommunityIcons name="receipt" size={16} color={ACCENT} />} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <StatBox c={c} label="PRODUCTS" value={String(d.total_products)} sub="✓ Catalog synced" subColor="#12805C" icon={<Ionicons name="cube-outline" size={16} color={ACCENT} />} />
              <StatBox c={c} label="LOW STOCK" value={String(d.low_stock_count)} sub={d.low_stock_count > 0 ? '⚠ Needs attention' : '✓ All healthy'} subColor={d.low_stock_count > 0 ? c.warn : '#12805C'} icon={<Ionicons name="warning-outline" size={16} color={ACCENT} />} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <StatBox c={c} label="LAST 7 DAYS" value={formatMoney(toCents(d.week_sales), currency)} sub="↗ Rolling 7-day total" icon={<Ionicons name="trending-up" size={16} color={ACCENT} />} />
              <StatBox c={c} label="THIS MONTH" value={formatMoney(toCents(d.month_sales), currency)} sub="✓ Month to date" subColor="#12805C" icon={<Ionicons name="calendar-outline" size={16} color={ACCENT} />} />
            </View>
          </>}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="fire" size={18} color={ACCENT} />
              <Text style={{ fontSize: 15.5, fontWeight: '700', color: c.text, marginLeft: 6 }}>Best sellers (30 days)</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/products/index')}><Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT }}>View catalog →</Text></TouchableOpacity>
          </View>
          {best.data?.length ? best.data.map((b) => {
            const p = prodByName.get(b.name);
            const sub = [catName(p?.category_id ?? null), p?.sku ? `SKU: ${p.sku}` : ''].filter(Boolean).join(' • ');
            return (
              <View key={b.name} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 12, marginVertical: 4 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8F4FB', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cube-outline" size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <Text style={{ fontWeight: '700', color: c.text, fontSize: 14.5 }} numberOfLines={1}>{b.name}</Text>
                  {!!sub && <Text style={{ color: c.sub, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
                </View>
                <View style={{ backgroundColor: '#E8F4FB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: ACCENT }}>{b.qty} sold</Text>
                </View>
              </View>
            );
          }) : <Sub>No sales yet in the last 30 days.</Sub>}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="list" size={18} color={ACCENT} />
              <Text style={{ fontSize: 15.5, fontWeight: '700', color: c.text, marginLeft: 6 }}>Recent transactions</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/sales/index')}><Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT }}>See all →</Text></TouchableOpacity>
          </View>
          {recent.data?.length ? recent.data.map((s) => {
            const st = statusStyle(s.status, c);
            return (
              <TouchableOpacity key={s.id} onPress={() => router.push(`/(tabs)/sales/${s.id}`)}>
                <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 13, marginVertical: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700', color: c.text, fontSize: 14.5 }}>{s.receipt_number}</Text>
                    <Text style={{ fontWeight: '800', color: c.text, fontSize: 14.5 }}>{formatMoney(toCents(s.total), currency)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ color: c.sub, fontSize: 12 }}>📅 {new Date(s.created_at).toLocaleString()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.dot, marginRight: 5 }} />
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: st.fg }}>{st.label}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }) : <EmptyState title="No transactions yet" hint="Completed sales will appear here." />}
        </>} />
    </Screen>
  );
}
