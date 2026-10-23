import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT, Button, Card, Chip, EmptyState, ErrorBox, Field, Loading, Screen, SearchBar, Sub, Title, TopBar, fieldFill, useC } from '@/components/ui';
import { categoryService, newIdempotencyKey, productService, salesService } from '@/services';
import { isSubmitting, setSubmitting, useCart, useSession } from '@/store/appStore';
import { calculateTotals, canApplyDiscount, formatMoney, toCents, validateCart } from '@/lib/money';
import type { PaymentMethod } from '@/types/database.types';

export function PosScreen() {
  const storeId = useSession((s) => s.store?.id) ?? ''; const settings = useSession((s) => s.settings); const currency = settings?.currency ?? 'USD';
  const email = useSession((s) => s.email);
  const [search, setSearch] = useState(''); const [cat, setCat] = useState<string | null>(null); const [scanning, setScanning] = useState(false);
  const [grid, setGrid] = useState(true); const [quick, setQuick] = useState(false); const [quickText, setQuickText] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const cats = useQuery({ queryKey: ['cats', storeId], enabled: !!storeId, queryFn: () => categoryService.list(storeId) });
  const products = useQuery({ queryKey: ['pos-products', storeId, search, cat], enabled: !!storeId, queryFn: () => productService.list(storeId, { search, categoryId: cat }) });
  const cart = useCart();
  const totals = useMemo(() => calculateTotals(cart.lines, { discountCents: cart.discountCents, taxRate: Number(settings?.tax_rate ?? 0) }), [cart.lines, cart.discountCents, settings]);
  const c = useC();
  const itemCount = cart.lines.reduce((s, l) => s + l.quantity, 0);
  const cashier = email ? email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()) : 'Cashier';
  const scan = async () => { if (!permission?.granted) { const r = await requestPermission(); if (!r.granted) { Alert.alert('Camera permission', 'Barcode scanning needs camera access. You can still search by name/SKU.'); return; } } setScanning(true); };
  const confirmClear = () => Alert.alert('Cancel this sale?', 'The cart will be cleared. Nothing has been charged.', [{ text: 'Keep selling' }, { text: 'Clear cart', style: 'destructive', onPress: () => cart.clear() }]);
  const quickAdd = async () => {
    const code = quickText.trim(); if (!code) return;
    const byBarcode = await productService.findByBarcode(storeId, code).catch(() => null) as unknown as { id: string; name: string; selling_price: number; stock_quantity: number } | null;
    const p = byBarcode ?? (products.data ?? []).find((x) => (x.sku ?? '').toLowerCase() === code.toLowerCase() || x.barcode === code);
    if (p) { cart.add({ productId: p.id, name: p.name, unitPriceCents: toCents(p.selling_price), stock: p.stock_quantity }); setQuickText(''); }
    else Alert.alert('Not found', `No product with SKU/barcode ${code} in this store.`);
  };
  return (
    <Screen>
      <TopBar title="Sell" icon="cash-register" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 25, fontWeight: '800', color: c.text }}>Point of Sale</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: fieldFill(c), borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}>
            <Ionicons name="person-circle-outline" size={16} color={c.sub} />
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.text, marginLeft: 5 }}>{cashier}</Text>
          </View>
        </View>
        <SearchBar value={search} onChange={setSearch} placeholder="Name, SKU or barcode..." />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <TouchableOpacity onPress={scan} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="barcode-scan" size={20} color={ACCENT} />
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: ACCENT, marginLeft: 7 }}>Scan Barcode via Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setQuick((q) => !q)} style={{ backgroundColor: '#E8F4FB', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: ACCENT }}>QUICK KEY</Text>
          </TouchableOpacity>
        </View>
        {quick && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: fieldFill(c), borderWidth: 1, borderColor: c.border, borderRadius: 12, height: 46, paddingHorizontal: 12 }}>
              <Ionicons name="keypad-outline" size={18} color="#94A3B8" />
              <TextInput style={{ flex: 1, marginLeft: 8, fontSize: 14.5, color: c.text }} placeholder="Type SKU or barcode" placeholderTextColor={c.sub} value={quickText} onChangeText={setQuickText} onSubmitEditing={quickAdd} returnKeyType="done" />
            </View>
            <TouchableOpacity onPress={quickAdd} style={{ backgroundColor: ACCENT, borderRadius: 12, height: 46, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
          <Chip label="All" active={!cat} onPress={() => setCat(null)} />{(cats.data ?? []).map((x) => <Chip key={x.id} label={x.name} active={cat === x.id} onPress={() => setCat(x.id)} />)}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.7, color: c.sub }}>AVAILABLE PRODUCTS ({products.data?.length ?? 0})</Text>
          <TouchableOpacity onPress={() => setGrid((g) => !g)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={grid ? 'grid-outline' : 'list-outline'} size={16} color={c.sub} />
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.sub, marginLeft: 5 }}>{grid ? 'Grid View' : 'List View'}</Text>
          </TouchableOpacity>
        </View>
        {products.isLoading ? <Loading /> : (
          <FlatList key={grid ? 'grid' : 'list'} scrollEnabled={false} style={{ marginTop: 6 }} data={products.data ?? []} keyExtractor={(p) => p.id} numColumns={grid ? 2 : 1}
            ListEmptyComponent={<EmptyState title="No products" hint="Add products first, or change filters." />}
            renderItem={({ item }) => (
              <TouchableOpacity style={{ flex: 1, margin: 4 }} disabled={item.stock_quantity <= 0 && !settings?.allow_negative_stock}
                onPress={() => cart.add({ productId: item.id, name: item.name, unitPriceCents: toCents(item.selling_price), stock: item.stock_quantity })}>
                <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 13 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#E8F4FB', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Ionicons name="cube-outline" size={19} color={ACCENT} />
                  </View>
                  <Text style={{ fontWeight: '700', color: c.text, fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ color: c.text, fontWeight: '700', marginTop: 3 }}>{formatMoney(toCents(item.selling_price), currency)}</Text>
                  <Text style={{ color: item.stock_quantity <= 0 ? c.danger : c.sub, fontSize: 12, marginTop: 2 }}>Stock: {item.stock_quantity}{item.stock_quantity <= 0 ? ' · Out' : ''}</Text>
                </View>
              </TouchableOpacity>)} />)}
        <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 16, marginTop: 14, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#E8F4FB', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cart-outline" size={20} color={ACCENT} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={{ fontWeight: '800', color: c.text, fontSize: 15.5 }}>Cart ({itemCount} items)</Text>
                <Text style={{ color: c.sub, fontSize: 12, marginTop: 1 }}>Draft order</Text>
              </View>
            </View>
            {cart.lines.length > 0 && <TouchableOpacity onPress={confirmClear} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="trash-outline" size={15} color={c.danger} />
              <Text style={{ color: c.danger, fontWeight: '600', fontSize: 13, marginLeft: 4 }}>Clear</Text>
            </TouchableOpacity>}
          </View>
          {cart.lines.length === 0 && <Text style={{ color: c.sub, fontSize: 13, marginTop: 12 }}>Cart is empty — tap a product to add it.</Text>}
          {cart.lines.map((l) => (
            <View key={l.productId} style={{ backgroundColor: fieldFill(c), borderRadius: 13, padding: 11, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cube-outline" size={16} color={ACCENT} />
                </View>
                <Text style={{ flex: 1, fontWeight: '700', color: c.text, fontSize: 13.5, marginLeft: 9 }} numberOfLines={1}>{l.name}</Text>
                <Text style={{ fontWeight: '800', color: c.text, fontSize: 13.5 }}>{formatMoney(l.unitPriceCents * l.quantity, currency)}</Text>
                <TouchableOpacity onPress={() => cart.remove(l.productId)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={17} color={c.sub} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
                <Text style={{ color: c.sub, fontSize: 12.5 }}>{formatMoney(l.unitPriceCents, currency)} x {l.quantity}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => cart.setQty(l.productId, l.quantity - 1)} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, color: c.text }}>−</Text></TouchableOpacity>
                  <Text style={{ minWidth: 26, textAlign: 'center', fontWeight: '700', color: c.text }}>{l.quantity}</Text>
                  <TouchableOpacity onPress={() => cart.setQty(l.productId, Math.min(l.quantity + 1, l.stock || l.quantity + 1))} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, color: c.text }}>+</Text></TouchableOpacity>
                </View>
              </View>
            </View>))}
          <Text style={{ textAlign: 'center', color: c.sub, fontSize: 12, marginTop: 14 }}>Subtotal {formatMoney(totals.subtotalCents, currency)} • Tax {formatMoney(totals.taxCents, currency)} • Discount -{formatMoney(totals.discountCents, currency)}</Text>
          <View style={{ borderTopWidth: 1, borderTopColor: c.border, marginTop: 12, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.8, color: c.sub }}>TOTAL</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', color: c.text }}>{formatMoney(totals.totalCents, currency)}</Text>
          </View>
          <TouchableOpacity disabled={cart.lines.length === 0} onPress={() => router.push('/(tabs)/pos/checkout')} style={{ backgroundColor: ACCENT, opacity: cart.lines.length === 0 ? 0.5 : 1, height: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
            <Ionicons name="cart" size={19} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 15.5, fontWeight: '700', marginLeft: 8 }}>Checkout ({formatMoney(totals.totalCents, currency)})</Text>
          </TouchableOpacity>
          {cart.lines.length > 0 && <TouchableOpacity onPress={confirmClear} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 13 }}>
            <Ionicons name="ban-outline" size={16} color={c.sub} />
            <Text style={{ color: c.sub, fontWeight: '600', fontSize: 13.5, marginLeft: 6 }}>Cancel sale</Text>
          </TouchableOpacity>}
        </View>
      </ScrollView>
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
