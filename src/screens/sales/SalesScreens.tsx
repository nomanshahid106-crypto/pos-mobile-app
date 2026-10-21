import React, { useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, EmptyState, ErrorBox, Field, Loading, Screen, Sub, Title } from '@/components/ui';
import { salesService, settingsService } from '@/services';
import { useSession } from '@/store/appStore';
import { formatMoney, toCents } from '@/lib/money';
import { printReceipt, receiptText, shareReceipt, type ReceiptData } from '@/lib/receipt';

interface SaleRow { id: string; receipt_number: string; created_at: string; total: number; status: string; payments?: { method: string }[]; }
interface SaleDetail extends SaleRow { subtotal: number; discount_amount: number; tax_amount: number; cashier_id: string; sale_items: { id: string; product_name: string; quantity: number; unit_price: number; line_total: number; refunded_quantity: number }[]; payments: { method: string; amount_received: number | null; change_due: number | null }[]; }

async function buildReceipt(saleId: string, storeName: string, currency: string, footer: string, address?: string | null, phone?: string | null): Promise<{ receipt: ReceiptData; detail: SaleDetail }> {
  const detail = await salesService.detail(saleId) as unknown as SaleDetail;
  const pay = detail.payments?.[0];
  return { detail, receipt: { storeName, storeAddress: address, storePhone: phone, receiptNumber: detail.receipt_number, createdAt: detail.created_at, items: detail.sale_items.map((i) => ({ name: i.product_name, quantity: i.quantity, unitPrice: Number(i.unit_price) })), subtotal: Number(detail.subtotal), discount: Number(detail.discount_amount), tax: Number(detail.tax_amount), total: Number(detail.total), paymentMethod: pay?.method ?? 'cash', amountReceived: pay?.amount_received, changeDue: pay?.change_due, currency, footer } };
}

export function SalesListScreen() {
  const storeId = useSession((s) => s.store?.id) ?? ''; const settings = useSession((s) => s.settings); const currency = settings?.currency ?? 'USD';
  const [search, setSearch] = useState(''); const [status, setStatus] = useState<string>(''); const [method, setMethod] = useState<string>('');
  const sales = useQuery({ queryKey: ['sales', storeId, search, status, method], enabled: !!storeId, queryFn: () => salesService.list(storeId, { search, status, method }) as unknown as Promise<SaleRow[]> });
  return (
    <Screen>
      <Title>Sales history</Title>
      <Field label="Search receipt #" value={search} onChangeText={setSearch} placeholder="R-2024…" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="All statuses" active={!status} onPress={() => setStatus('')} /><Chip label="Completed" active={status === 'completed'} onPress={() => setStatus('completed')} /><Chip label="Refunded" active={status === 'refunded'} onPress={() => setStatus('refunded')} /><Chip label="Partial refund" active={status === 'partially_refunded'} onPress={() => setStatus('partially_refunded')} />
        <Chip label="Cash only" active={method === 'cash'} onPress={() => setMethod(method === 'cash' ? '' : 'cash')} /><Chip label="Card only" active={method === 'card_manual'} onPress={() => setMethod(method === 'card_manual' ? '' : 'card_manual')} />
      </View>
      {!!sales.error && <ErrorBox message={(sales.error as Error).message} />}
      {sales.isLoading ? <Loading /> : (
        <FlatList data={sales.data ?? []} keyExtractor={(s) => s.id} ListEmptyComponent={<EmptyState title="No sales found" hint="Completed sales appear here and are never hard-deleted." />}
          renderItem={({ item }) => <TouchableOpacity onPress={() => router.push(`/(tabs)/sales/${item.id}`)}><Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '600' }}>{item.receipt_number}</Text><Text>{formatMoney(toCents(item.total), currency)}</Text></View><Sub>{new Date(item.created_at).toLocaleString()} · {item.status}</Sub></Card></TouchableOpacity>} />)}
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
