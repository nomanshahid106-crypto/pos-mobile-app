import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Button, Card, Chip, EmptyState, ErrorBox, Field, Loading, Screen, Sub, Title, useC } from '@/components/ui';
import { categoryService, newIdempotencyKey, productService, salesService } from '@/services';
import { isSubmitting, setSubmitting, useCart, useSession } from '@/store/appStore';
import { calculateTotals, canApplyDiscount, formatMoney, toCents, validateCart } from '@/lib/money';
import type { PaymentMethod } from '@/types/database.types';

export function PosScreen() {
  const storeId = useSession((s) => s.store?.id) ?? ''; const settings = useSession((s) => s.settings); const currency = settings?.currency ?? 'USD';
  const [search, setSearch] = useState(''); const [cat, setCat] = useState<string | null>(null); const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cats = useQuery({ queryKey: ['cats', storeId], enabled: !!storeId, queryFn: () => categoryService.list(storeId) });
  const products = useQuery({ queryKey: ['pos-products', storeId, search, cat], enabled: !!storeId, queryFn: () => productService.list(storeId, { search, categoryId: cat }) });
  const cart = useCart();
  const totals = useMemo(() => calculateTotals(cart.lines, { discountCents: cart.discountCents, taxRate: Number(settings?.tax_rate ?? 0) }), [cart.lines, cart.discountCents, settings]);
  const c = useC();
  const scan = async () => { if (!permission?.granted) { const r = await requestPermission(); if (!r.granted) { Alert.alert('Camera permission', 'Barcode scanning needs camera access. You can still search by name/SKU.'); return; } } setScanning(true); };
  return (
    <Screen>
      <Title>Point of Sale</Title>
      <Field label="Search" placeholder="Name, SKU or barcode" value={search} onChangeText={setSearch} />
      <Button title="📷 Scan barcode" variant="ghost" onPress={scan} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
        <Chip label="All" active={!cat} onPress={() => setCat(null)} />{(cats.data ?? []).map((x) => <Chip key={x.id} label={x.name} active={cat === x.id} onPress={() => setCat(x.id)} />)}
      </ScrollView>
      {products.isLoading ? <Loading /> : (
        <FlatList style={{ flex: 1 }} data={products.data ?? []} keyExtractor={(p) => p.id} numColumns={2}
          ListEmptyComponent={<EmptyState title="No products" hint="Add products first, or change filters." />}
          renderItem={({ item }) => (
            <TouchableOpacity style={{ flex: 1, margin: 4 }} disabled={item.stock_quantity <= 0 && !settings?.allow_negative_stock}
              onPress={() => cart.add({ productId: item.id, name: item.name, unitPriceCents: toCents(item.selling_price), stock: item.stock_quantity })}>
              <Card style={{ marginVertical: 0 }}><Text style={{ fontWeight: '600', color: c.text }}>{item.name}</Text><Text style={{ color: c.text }}>{formatMoney(toCents(item.selling_price), currency)}</Text><Sub>Stock: {item.stock_quantity}{item.stock_quantity <= 0 ? ' · Out' : ''}</Sub></Card>
            </TouchableOpacity>)} />)}
      <Card>
        <Text style={{ fontWeight: '700' }}>Cart ({cart.lines.reduce((s, l) => s + l.quantity, 0)} items)</Text>
        {cart.lines.map((l) => (
          <View key={l.productId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ flex: 1, color: c.text }}>{l.name}</Text>
            <TouchableOpacity onPress={() => cart.setQty(l.productId, l.quantity - 1)}><Text style={{ fontSize: 20, paddingHorizontal: 8 }}>−</Text></TouchableOpacity>
            <Text>{l.quantity}</Text>
            <TouchableOpacity onPress={() => cart.setQty(l.productId, Math.min(l.quantity + 1, l.stock || l.quantity + 1))}><Text style={{ fontSize: 20, paddingHorizontal: 8 }}>+</Text></TouchableOpacity>
            <Text style={{ width: 70, textAlign: 'right' }}>{formatMoney(l.unitPriceCents * l.quantity, currency)}</Text>
            <TouchableOpacity onPress={() => cart.remove(l.productId)}><Text style={{ color: c.danger, paddingLeft: 8 }}>✕</Text></TouchableOpacity>
          </View>))}
        <Sub>Subtotal {formatMoney(totals.subtotalCents, currency)} · Tax {formatMoney(totals.taxCents, currency)} · Discount −{formatMoney(totals.discountCents, currency)}</Sub>
        <Text style={{ fontWeight: '700', fontSize: 18, marginVertical: 4 }}>Total {formatMoney(totals.totalCents, currency)}</Text>
        <Button title="Checkout" disabled={cart.lines.length === 0} onPress={() => router.push('/(tabs)/pos/checkout')} />
        <Button title="Cancel sale" variant="ghost" onPress={() => Alert.alert('Cancel this sale?', 'The cart will be cleared. Nothing has been charged.', [{ text: 'Keep selling' }, { text: 'Clear cart', style: 'destructive', onPress: () => cart.clear() }])} />
      </Card>
      <Modal visible={scanning} animationType="slide">
        <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'qr', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={async ({ data }) => { setScanning(false); const found = await productService.findByBarcode(storeId, data).catch(() => null); const p = found as unknown as { id: string; name: string; selling_price: number; stock_quantity: number } | null; if (p) cart.add({ productId: p.id, name: p.name, unitPriceCents: toCents(p.selling_price), stock: p.stock_quantity }); else Alert.alert('Not found', `No product with barcode ${data} in this store.`); }} />
        <Button title="Close scanner" onPress={() => setScanning(false)} />
      </Modal>
    </Screen>
  );
}

export function CheckoutScreen() {
  const store = useSession((s) => s.store); const settings = useSession((s) => s.settings); const role = useSession((s) => s.role) ?? 'cashier';
  const currency = settings?.currency ?? 'USD'; const cart = useCart(); const qc = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>('cash'); const [received, setReceived] = useState(''); const [reference, setReference] = useState('');
  const [discountPercent, setDiscountPercent] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const totals = useMemo(() => calculateTotals(cart.lines, { discountCents: cart.discountCents, taxRate: Number(settings?.tax_rate ?? 0) }), [cart.lines, cart.discountCents, settings]);
  const receivedCents = toCents(parseFloat(received) || 0);
  const change = method === 'cash' && received ? receivedCents - totals.totalCents : null;

  const applyDiscount = () => {
    const pct = parseFloat(discountPercent) || 0;
    const cents = Math.round((totals.subtotalCents * pct) / 100);
    if (!canApplyDiscount(role, cents, totals.subtotalCents, { maxDiscountPercent: Number(settings?.max_discount_percent ?? 100), cashierMaxDiscountPercent: Number(settings?.cashier_max_discount_percent ?? 0) })) { setError('That discount exceeds your authorized limit for your role.'); return; }
    setError(''); cart.setDiscountCents(cents);
  };

  const complete = async () => {
    if (isSubmitting()) return; // duplicate-submit guard (DB idempotency key is the backstop)
    const problems = validateCart(cart.lines, { allowNegativeStock: !!settings?.allow_negative_stock });
    if (problems.length) { setError(problems.join('\n')); return; }
    if (method === 'cash' && receivedCents < totals.totalCents) { setError('Amount received is less than the total.'); return; }
    setSubmitting(true); setBusy(true); setError('');
    try {
      const key = cart.ensureKey(newIdempotencyKey);
      const result = await salesService.checkout({
        storeId: store!.id, idempotencyKey: key,
        items: cart.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        discountAmount: totals.discountCents / 100, paymentMethod: method,
        amountReceived: method === 'cash' ? receivedCents / 100 : null,
        externalReference: method === 'cash' ? null : (reference || 'manual-external'),
      }) as unknown as { sale_id: string };
      cart.clear(); qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['dash'] }); qc.invalidateQueries({ queryKey: ['recent'] });
      router.replace(`/(tabs)/sales/receipt/${result.sale_id}`);
    } catch (e) { setError((e as Error).message); } finally { setSubmitting(false); setBusy(false); }
  };

  return (
    <Screen><ScrollView keyboardShouldPersistTaps="handled">
      <Title>Checkout</Title>
      {method !== 'cash' && <Card><Text>⚠ Manual / externally-processed payment. This records a payment taken outside the app (e.g. your card terminal). No card is charged by this app, and no card numbers are stored.</Text></Card>}
      <Text style={{ fontWeight: '600', marginTop: 8 }}>Payment method</Text>
      <View style={{ flexDirection: 'row', marginVertical: 6 }}>
        <Chip label="Cash" active={method === 'cash'} onPress={() => setMethod('cash')} /><Chip label="Card (manual)" active={method === 'card_manual'} onPress={() => setMethod('card_manual')} /><Chip label="Other" active={method === 'other'} onPress={() => setMethod('other')} />
      </View>
      <Field label="Discount % (authorized roles/limits enforced by server)" keyboardType="decimal-pad" value={discountPercent} onChangeText={setDiscountPercent} />
      <Button title="Apply discount" variant="ghost" onPress={applyDiscount} />
      {method === 'cash' && <Field label="Amount received" keyboardType="decimal-pad" value={received} onChangeText={setReceived} />}
      {method !== 'cash' && <Field label="External reference (terminal receipt #)" value={reference} onChangeText={setReference} />}
      <Card>
        <Text>Subtotal {formatMoney(totals.subtotalCents, currency)}</Text><Text>Discount −{formatMoney(totals.discountCents, currency)}</Text>
        <Text>Tax {formatMoney(totals.taxCents, currency)}</Text><Text style={{ fontWeight: '700', fontSize: 18 }}>Total {formatMoney(totals.totalCents, currency)}</Text>
        {change != null && <Text style={{ fontWeight: '600' }}>Change due: {change >= 0 ? formatMoney(change, currency) : '— insufficient'}</Text>}
      </Card>
      {!!error && <ErrorBox message={error} />}
      <Button title={busy ? 'Processing…' : 'Complete sale'} loading={busy} disabled={busy || cart.lines.length === 0} onPress={complete} />
      <Button title="Back to POS" variant="ghost" onPress={() => router.back()} />
    </ScrollView></Screen>
  );
}
