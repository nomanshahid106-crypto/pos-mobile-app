import React, { useState } from 'react';
import { Alert, FlatList, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT, Button, Card, Chip, EmptyState, ErrorBox, Field, Loading, Screen, SearchBar, Sub, Title, TopBar, fieldFill, useC } from '@/components/ui';
import { salesService, settingsService } from '@/services';
import { useSession } from '@/store/appStore';
import { formatMoney, toCents } from '@/lib/money';
import { printReceipt, receiptText, shareReceipt, type ReceiptData } from '@/lib/receipt';

interface SaleRow { id: string; receipt_number: string; created_at: string; total: number; status: string; payments?: { method: string }[]; sale_items?: { product_name: string; quantity: number }[]; }
interface SaleDetail extends SaleRow { subtotal: number; discount_amount: number; tax_amount: number; cashier_id: string; sale_items: { id: string; product_name: string; quantity: number; unit_price: number; line_total: number; refunded_quantity: number }[]; payments: { method: string; amount_received: number | null; change_due: number | null }[]; }

async function buildReceipt(saleId: string, storeName: string, currency: string, footer: string, address?: string | null, phone?: string | null): Promise<{ receipt: ReceiptData; detail: SaleDetail }> {
  const detail = await salesService.detail(saleId) as unknown as SaleDetail;
  const pay = detail.payments?.[0];
  return { detail, receipt: { storeName, storeAddress: address, storePhone: phone, receiptNumber: detail.receipt_number, createdAt: detail.created_at, items: detail.sale_items.map((i) => ({ name: i.product_name, quantity: i.quantity, unitPrice: Number(i.unit_price) })), subtotal: Number(detail.subtotal), discount: Number(detail.discount_amount), tax: Number(detail.tax_amount), total: Number(detail.total), paymentMethod: pay?.method ?? 'cash', amountReceived: pay?.amount_received, changeDue: pay?.change_due, currency, footer } };
}

export function SalesListScreen() {
  const storeId = useSession((s) => s.store?.id) ?? ''; const settings = useSession((s) => s.settings); const currency = settings?.currency ?? 'USD';
  const c = useC();
  const [search, setSearch] = useState(''); const [status, setStatus] = useState<string>(''); const [method, setMethod] = useState<string>(''); const [range, setRange] = useState<'today' | 'all'>('today');
  const from = range === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : undefined;
  const sales = useQuery({ queryKey: ['sales', storeId, search, status, method, range], enabled: !!storeId, queryFn: () => salesService.list(storeId, { search, status, method, from }) as unknown as Promise<SaleRow[]> });
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const today = useQuery({ queryKey: ['sales-today', storeId], enabled: !!storeId, queryFn: () => salesService.list(storeId, { from: todayStart }) as unknown as Promise<SaleRow[]> });
  const allSales = useQuery({ queryKey: ['sales-all', storeId], enabled: !!storeId, queryFn: () => salesService.list(storeId, {}) as unknown as Promise<SaleRow[]> });
  const todayRows = (today.data ?? []).filter((s) => s.status !== 'refunded');
  const todayTotal = todayRows.reduce((sum, s) => sum + Number(s.total), 0);
  const byMethod = (m: string) => todayRows.filter((s) => (s.payments?.[0]?.method ?? 'cash') === m).reduce((sum, s) => sum + Number(s.total), 0);
  const cashTotal = byMethod('cash'); const cardTotal = byMethod('card_manual') + byMethod('other');
  const exportCsv = () => {
    const rows = sales.data ?? [];
    if (!rows.length) { Alert.alert('Nothing to export', 'No sales match the current filters.'); return; }
    const csv = ['Receipt,Date,Status,Total,Method', ...rows.map((s) => [s.receipt_number, new Date(s.created_at).toISOString(), s.status, String(s.total), s.payments?.[0]?.method ?? ''].join(','))].join('\n');
    Share.share({ message: csv, title: 'Sales export' });
  };
  const statusPill = (st: string) => st === 'completed'
    ? { bg: '#E7F8EE', fg: '#12805C', dot: '#22C55E', label: 'Completed' }
    : st === 'refunded' ? { bg: '#FDECEC', fg: '#B42318', dot: '#EF4444', label: 'Refunded' }
    : { bg: '#FEF6E0', fg: '#9A6B00', dot: '#F59E0B', label: 'Partial' };
  return (
    <Screen>
      <TopBar title="Sales" icon="script-text-outline" />
      <View style={{ backgroundColor: '#DCEAF8', borderRadius: 20, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.7, color: '#39597E' }}>SHIFT{'\n'}PERFORMANCE</Text>
          <View style={{ backgroundColor: '#CDEEDD', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 10, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 5 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0B6B43' }}>Register Active</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
            <Ionicons name="cloud-upload-outline" size={15} color="#39597E" />
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#39597E', marginLeft: 4 }}>Live{'\n'}Synced</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 27, fontWeight: '800', color: '#0E2A47', marginTop: 8 }}>{formatMoney(toCents(todayTotal), currency)}</Text>
            <Text style={{ fontSize: 12, color: '#39597E', marginTop: 3 }}>Total Sales Today · {todayRows.length} transactions closed</Text>
          </View>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="cash-register" size={26} color="#0B5FA5" />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><SearchBar value={search} onChange={setSearch} placeholder="Search receipt # or customer..." /></View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/pos')} accessibilityLabel="Scan barcode" style={{ width: 47, height: 47, borderRadius: 13, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginLeft: 9 }}>
          <MaterialCommunityIcons name="barcode-scan" size={23} color={ACCENT} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 2 }}>
        <TouchableOpacity onPress={() => setStatus('')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: !status ? '#0B5FA5' : c.card, borderWidth: 1, borderColor: !status ? '#0B5FA5' : c.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: !status ? '#FFFFFF' : c.text }}>All statuses</Text>
          <View style={{ minWidth: 19, height: 19, borderRadius: 10, backgroundColor: !status ? '#FFFFFF' : fieldFill(c), alignItems: 'center', justifyContent: 'center', marginLeft: 7, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: !status ? '#0B5FA5' : c.sub }}>{allSales.data?.length ?? 0}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStatus('completed')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: status === 'completed' ? '#0B5FA5' : c.card, borderWidth: 1, borderColor: status === 'completed' ? '#0B5FA5' : c.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 }} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: status === 'completed' ? '#FFFFFF' : c.text }}>Completed</Text>
        </TouchableOpacity>
        <Chip label="Refunded" active={status === 'refunded'} onPress={() => setStatus('refunded')} />
        <Chip label="Partial" active={status === 'partially_refunded'} onPress={() => setStatus('partially_refunded')} />
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
        <TouchableOpacity onPress={() => setMethod(method === '' ? 'cash' : method === 'cash' ? 'card_manual' : '')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 }}>
          <Ionicons name="wallet-outline" size={15} color={c.sub} style={{ marginRight: 5 }} />
          <Text style={{ fontSize: 13, fontWeight: '500', color: c.text }}>{method === 'cash' ? 'Cash only' : method === 'card_manual' ? 'Card only' : 'All methods'}</Text>
          <Ionicons name="chevron-down" size={14} color={c.sub} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRange(range === 'today' ? 'all' : 'today')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Ionicons name="calendar-outline" size={15} color={c.sub} style={{ marginRight: 5 }} />
          <Text style={{ fontSize: 13, fontWeight: '500', color: c.text }}>{range === 'today' ? 'Today' : 'All time'}</Text>
          <Ionicons name="chevron-down" size={14} color={c.sub} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={exportCsv} accessibilityLabel="Export sales as CSV" style={{ marginLeft: 'auto', width: 38, height: 38, borderRadius: 19, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="download-outline" size={18} color={c.text} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '700', color: c.text }}>Recent Transactions</Text>
        <Text style={{ fontSize: 12, color: c.sub }}>Showing {sales.data?.length ?? 0} of {allSales.data?.length ?? 0}</Text>
      </View>
      {!!sales.error && <ErrorBox message={(sales.error as Error).message} />}
      {sales.isLoading ? <Loading /> : (
        <FlatList data={sales.data ?? []} keyExtractor={(s) => s.id} ListEmptyComponent={<EmptyState title="No sales found" hint="Completed sales appear here and are never hard-deleted." />}
          ListFooterComponent={(
            <View style={{ backgroundColor: '#DCEAF8', borderRadius: 18, padding: 15, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="document-text-outline" size={19} color="#FFFFFF" />
                  </View>
                  <Text style={{ fontWeight: '700', color: c.text, fontSize: 14.5, marginLeft: 9 }}>Daily Register Summary</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert('End of Day — Register Summary', `Cash drawer: ${formatMoney(toCents(cashTotal), currency)}\nCard terminal: ${formatMoney(toCents(cardTotal), currency)}\nNet Shift Balance: ${formatMoney(toCents(todayTotal), currency)}\nTransactions closed: ${todayRows.length}`)}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: ACCENT }}>End of Day →</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 13 }}>
                <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, padding: 12, marginRight: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="cash-outline" size={15} color={c.sub} /><Text style={{ fontSize: 12, color: c.sub, marginLeft: 5 }}>Cash drawer</Text></View>
                  <Text style={{ fontWeight: '800', color: c.text, fontSize: 15, marginTop: 5 }}>{formatMoney(toCents(cashTotal), currency)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, padding: 12, marginLeft: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="card-outline" size={15} color={c.sub} /><Text style={{ fontSize: 12, color: c.sub, marginLeft: 5 }}>Card terminal</Text></View>
                  <Text style={{ fontWeight: '800', color: c.text, fontSize: 15, marginTop: 5 }}>{formatMoney(toCents(cardTotal), currency)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13 }}>
                <Text style={{ fontSize: 13, color: c.sub }}>Net Shift Balance</Text>
                <Text style={{ fontWeight: '800', color: c.text, fontSize: 15.5 }}>{formatMoney(toCents(todayTotal), currency)}</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => {
            const pill = statusPill(item.status);
            const methodLabel = item.payments?.[0]?.method === 'card_manual' ? 'Card' : item.payments?.[0]?.method === 'other' ? 'Other' : 'Cash';
            const first = item.sale_items?.[0];
            const totalQty = (item.sale_items ?? []).reduce((sum, i) => sum + i.quantity, 0);
            return (
              <TouchableOpacity onPress={() => router.push(`/(tabs)/sales/${item.id}`)}>
                <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 14, marginVertical: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700', color: c.text, fontSize: 14.5, flexShrink: 1 }} numberOfLines={1}>{item.receipt_number}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pill.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pill.dot, marginRight: 4.5 }} />
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: pill.fg }}>{pill.label}</Text>
                    </View>
                    <Text style={{ fontWeight: '800', color: c.text, fontSize: 15.5, marginLeft: 'auto' }}>{formatMoney(toCents(item.total), currency)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ color: c.sub, fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF1F8', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3.5, marginLeft: 'auto' }}>
                      <Ionicons name={methodLabel === 'Cash' ? 'cash-outline' : 'card-outline'} size={13} color={c.sub} />
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: c.text, marginLeft: 4 }}>{methodLabel}</Text>
                    </View>
                  </View>
                  {!!first && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: fieldFill(c), borderRadius: 12, padding: 10, marginTop: 10 }}>
                      <View style={{ width: 31, height: 31, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="cube-outline" size={17} color={ACCENT} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 9 }}>
                        <Text style={{ fontWeight: '600', color: c.text, fontSize: 13 }} numberOfLines={1}>{first.product_name}</Text>
                        <Text style={{ color: c.sub, fontSize: 11.5, marginTop: 1 }}>{totalQty} Item{totalQty === 1 ? '' : 's'} · Line 01{(item.sale_items?.length ?? 0) > 1 ? ` +${(item.sale_items?.length ?? 1) - 1} more` : ''}</Text>
                      </View>
                      <View style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="chevron-forward" size={15} color={c.sub} />
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }} />)}
    </Screen>
  );
}

export function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useSession((s) => s.store); const settings = useSession((s) => s.settings); const role = useSession((s) => s.role); const currency = settings?.currency ?? 'USD'; const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['sale', id], queryFn: () => salesService.detail(id) as unknown as Promise<SaleDetail> });
  const [refundQty, setRefundQty] = useState<Record<string, string>>({}); const [reason, setReason] = useState(''); const [msg, setMsg] = useState('');
  if (detail.isLoading) return <Screen><Loading /></Screen>;
  if (!detail.data) return <Screen><EmptyState title="Sale not found" /></Screen>;
  const s = detail.data; const canRefund = role === 'owner' || role === 'manager';
  const doRefund = async () => {
    const items = s.sale_items.filter((i) => parseInt(refundQty[i.id] || '0', 10) > 0).map((i) => ({ sale_item_id: i.id, quantity: parseInt(refundQty[i.id], 10) }));
    if (!items.length) { setMsg('Enter a refund quantity for at least one item.'); return; }
    Alert.alert('Confirm refund', 'Stock will be returned to inventory and the sale status updated. This cannot be undone.', [{ text: 'Cancel' }, { text: 'Process refund', style: 'destructive', onPress: async () => { try { await salesService.refund(id, items, reason || undefined); setMsg('Refund processed. Inventory restored.'); detail.refetch(); qc.invalidateQueries({ queryKey: ['products'] }); } catch (e) { setMsg((e as Error).message); } } }]);
  };
  return (
    <Screen><ScrollView>
      <Title>{s.receipt_number}</Title><Sub>{new Date(s.created_at).toLocaleString()} · {s.status}</Sub>
      {s.sale_items.map((i) => <Card key={i.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>{i.product_name} × {i.quantity}{i.refunded_quantity ? ` (refunded ${i.refunded_quantity})` : ''}</Text><Text>{formatMoney(toCents(i.line_total), currency)}</Text></View>
        {canRefund && i.refunded_quantity < i.quantity && <Field label="Refund qty" keyboardType="number-pad" value={refundQty[i.id] ?? ''} onChangeText={(t) => setRefundQty({ ...refundQty, [i.id]: t })} />}</Card>)}
      <Card><Text>Subtotal {formatMoney(toCents(s.subtotal), currency)} · Discount −{formatMoney(toCents(s.discount_amount), currency)} · Tax {formatMoney(toCents(s.tax_amount), currency)}</Text><Text style={{ fontWeight: '700' }}>Total {formatMoney(toCents(s.total), currency)}</Text><Sub>Paid via {s.payments?.[0]?.method ?? '—'}</Sub></Card>
      <Button title="View / reprint receipt" onPress={() => router.push(`/(tabs)/sales/receipt/${id}`)} />
      {canRefund && <><Field label="Refund reason" value={reason} onChangeText={setReason} />{!!msg && <Sub>{msg}</Sub>}<Button title="Process refund (owner/manager)" variant="danger" onPress={doRefund} /></>}
      {!canRefund && <Sub>Refunds require Owner or Manager role.</Sub>}
    </ScrollView></Screen>
  );
}

export function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useSession((s) => s.store); const settings = useSession((s) => s.settings);
  const [text, setText] = useState(''); const [data, setData] = useState<ReceiptData | null>(null); const [error, setError] = useState('');
  React.useEffect(() => { (async () => { try { const storeRow = store?.id ? await settingsService.getStore(store.id).catch(() => store) : store; const st = storeRow as unknown as { name: string; address?: string | null; phone?: string | null }; const { receipt } = await buildReceipt(id, st?.name ?? 'Store', settings?.currency ?? 'USD', settings?.receipt_footer ?? 'Thank you for your business!', st?.address, st?.phone); setData(receipt); setText(receiptText(receipt)); } catch (e) { setError((e as Error).message); } })(); }, [id]);
  return (
    <Screen><ScrollView>
      <Title>Receipt</Title>{!!error && <ErrorBox message={error} />}
      {data ? <><Card><Text style={{ fontFamily: 'monospace' }}>{text}</Text></Card>
        <Button title="Print receipt" onPress={() => printReceipt(data)} />
        <Button title="Share receipt (PDF)" variant="ghost" onPress={() => shareReceipt(data)} /></>
        : <Loading />}
    </ScrollView></Screen>
  );
}
