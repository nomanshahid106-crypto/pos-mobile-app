import React, { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, EmptyState, ErrorBox, Field, Loading, Screen, Sub, Title, useC } from '@/components/ui';
import { categoryService, inventoryService, productService } from '@/services';
import { useSession } from '@/store/appStore';
import { formatMoney, isLowStock, toCents } from '@/lib/money';
import { productSchema, categorySchema, stockAdjustSchema, type ProductForm } from '@/validation/schemas';
import type { Category, Product } from '@/types/database.types';

const canEdit = (role: string | null) => role === 'owner' || role === 'manager';

export function ProductListScreen() {
  const storeId = useSession((s) => s.store?.id) ?? ''; const role = useSession((s) => s.role);
  const settings = useSession((s) => s.settings); const currency = settings?.currency ?? 'USD';
  const [search, setSearch] = useState(''); const [cat, setCat] = useState<string | null>(null); const [stock, setStock] = useState<'all' | 'low' | 'out'>('all'); const [sort, setSort] = useState<'name' | 'price' | 'stock'>('name');
  const cats = useQuery({ queryKey: ['cats', storeId], enabled: !!storeId, queryFn: () => categoryService.list(storeId) });
  const products = useQuery({ queryKey: ['products', storeId, search, cat, stock], enabled: !!storeId, queryFn: () => productService.list(storeId, { search, categoryId: cat, stock }) });
  const sorted = useMemo(() => [...(products.data ?? [])].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'price' ? a.selling_price - b.selling_price : a.stock_quantity - b.stock_quantity), [products.data, sort]);
  const c = useC();
  return (
    <Screen>
      <Title>Products</Title>
      <Field label="Search" placeholder="Name, SKU or barcode" value={search} onChangeText={setSearch} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
        <Chip label="All categories" active={!cat} onPress={() => setCat(null)} />
        {(cats.data ?? []).map((x) => <Chip key={x.id} label={x.name} active={cat === x.id} onPress={() => setCat(x.id)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        <Chip label="All stock" active={stock === 'all'} onPress={() => setStock('all')} /><Chip label="Low" active={stock === 'low'} onPress={() => setStock('low')} /><Chip label="Out" active={stock === 'out'} onPress={() => setStock('out')} />
        <Chip label={`Sort: ${sort}`} onPress={() => setSort(sort === 'name' ? 'price' : sort === 'price' ? 'stock' : 'name')} />
      </View>
      {!!products.error && <ErrorBox message={(products.error as Error).message} />}
      {canEdit(role) && <><Button title="+ Add product" onPress={() => router.push('/(tabs)/products/new')} /><Button title="Categories & inventory" variant="ghost" onPress={() => router.push('/(tabs)/products/categories')} /></>}
      {products.isLoading ? <Loading /> : (
        <FlatList data={sorted} keyExtractor={(p) => p.id} ListEmptyComponent={<EmptyState title="No products found" hint="Add a product or change your filters." />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(tabs)/products/${item.id}`)}>
              <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '600', color: c.text, flex: 1 }}>{item.name}</Text><Text style={{ color: c.text }}>{formatMoney(toCents(item.selling_price), currency)}</Text></View>
                <Sub>SKU {item.sku ?? '—'} · Stock {item.stock_quantity}{isLowStock(item.stock_quantity, item.low_stock_threshold) ? ' · ⚠ Low stock' : ''}</Sub></Card>
            </TouchableOpacity>)} />)}
    </Screen>
  );
}

export function ProductFormScreen({ existing }: { existing?: Product }) {
  const storeId = useSession((s) => s.store?.id) ?? '';
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['cats', storeId], enabled: !!storeId, queryFn: () => categoryService.list(storeId) });
  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: existing ? { name: existing.name, sku: existing.sku ?? '', barcode: existing.barcode ?? '', description: existing.description ?? '', categoryId: existing.category_id, costPrice: existing.cost_price, sellingPrice: existing.selling_price, stockQuantity: existing.stock_quantity, lowStockThreshold: existing.low_stock_threshold, isActive: existing.is_active } : { name: '', costPrice: 0, sellingPrice: 0, stockQuantity: 0, lowStockThreshold: 5, isActive: true },
  });
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: async (v: ProductForm) => {
      const row = { store_id: storeId, name: v.name.trim(), sku: v.sku || null, barcode: v.barcode || null, description: v.description || null, category_id: v.categoryId || null, cost_price: v.costPrice, selling_price: v.sellingPrice, stock_quantity: v.stockQuantity, low_stock_threshold: v.lowStockThreshold, is_active: v.isActive };
      return existing ? productService.update(existing.id, row) : productService.create(row);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); router.back(); },
    onError: (e) => setError((e as Error).message),
  });
  const F = ({ name, label, keyboard }: { name: keyof ProductForm; label: string; keyboard?: 'numeric' | 'default' }) => (
    <Controller control={control} name={name} render={({ field: { onChange, value } }) => <Field label={label} keyboardType={keyboard === 'numeric' ? 'decimal-pad' : 'default'} value={value == null ? '' : String(value)} onChangeText={onChange} error={errors[name]?.message as string} />} />
  );
  return (
    <Screen><ScrollView keyboardShouldPersistTaps="handled">
      <Title>{existing ? 'Edit product' : 'New product'}</Title>{!!error && <ErrorBox message={error} />}
      <F name="name" label="Name" /><F name="sku" label="SKU" /><F name="barcode" label="Barcode" /><F name="description" label="Description" />
      <Text style={{ fontWeight: '500', marginTop: 8 }}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
        <Chip label="None" active={!watch('categoryId')} onPress={() => setValue('categoryId', null)} />
        {(cats.data ?? []).map((x: Category) => <Chip key={x.id} label={x.name} active={watch('categoryId') === x.id} onPress={() => setValue('categoryId', x.id)} />)}
      </ScrollView>
      <F name="costPrice" label="Purchase cost" keyboard="numeric" /><F name="sellingPrice" label="Selling price" keyboard="numeric" />
      <F name="stockQuantity" label="Stock quantity" keyboard="numeric" /><F name="lowStockThreshold" label="Low-stock threshold" keyboard="numeric" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 }}><Text>Active</Text><Switch value={!!watch('isActive')} onValueChange={(v) => setValue('isActive', v)} /></View>
      <Button title="Save product" loading={isSubmitting || save.isPending} onPress={handleSubmit((v) => save.mutate(v))} />
    </ScrollView></Screen>
  );
}

export function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useSession((s) => s.role); const qc = useQueryClient();
  const product = useQuery({ queryKey: ['product', id], queryFn: () => productService.get(id) as unknown as Promise<Product> });
  const movements = useQuery({ queryKey: ['movements', id], queryFn: () => inventoryService.movements(product.data?.store_id ?? '', id), enabled: !!product.data });
  const { control, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(stockAdjustSchema), defaultValues: { change: 0, reason: '' } });
  const [msg, setMsg] = useState('');
  if (product.isLoading) return <Screen><Loading /></Screen>;
  if (!product.data) return <Screen><EmptyState title="Product not found" /></Screen>;
  const p = product.data;
  return (
    <Screen><ScrollView>
      <Title>{p.name}</Title><Sub>{p.description ?? ''}</Sub>
      <Card><Text>Price {p.selling_price} · Cost {p.cost_price}</Text><Text>Stock {p.stock_quantity} (low at ≤ {p.low_stock_threshold})</Text><Text>SKU {p.sku ?? '—'} · Barcode {p.barcode ?? '—'} · {p.is_active ? 'Active' : 'Archived'}</Text></Card>
      {canEdit(role) && <>
        <Button title="Edit product" onPress={() => router.push(`/(tabs)/products/new?edit=${p.id}`)} />
        <Button title="Archive product" variant="danger" onPress={() => Alert.alert('Archive product?', 'Archived products disappear from POS but sales history is kept.', [{ text: 'Cancel' }, { text: 'Archive', style: 'destructive', onPress: async () => { await productService.archive(p.id); qc.invalidateQueries({ queryKey: ['products'] }); router.back(); } }])} />
        <Card><Text style={{ fontWeight: '700' }}>Adjust stock</Text>
          <Controller control={control} name="change" render={({ field: { onChange, value } }) => <Field label="Change (+ stock in / − correction)" keyboardType="numbers-and-punctuation" value={String(value)} onChangeText={onChange} error={errors.change?.message} />} />
          <Controller control={control} name="reason" render={({ field: { onChange, value } }) => <Field label="Reason (required)" value={value} onChangeText={onChange} error={errors.reason?.message} />} />
          {!!msg && <Sub>{msg}</Sub>}
          <Button title="Apply adjustment" onPress={handleSubmit(async (v) => { try { const n = await inventoryService.adjust(p.id, v.change, v.reason, v.change > 0 ? 'stock_in' : 'adjustment'); setMsg(`Stock is now ${n}.`); product.refetch(); movements.refetch(); } catch (e) { setMsg((e as Error).message); } })} />
        </Card>
      </>}
      <Text style={{ fontWeight: '700', fontSize: 16, marginTop: 10 }}>Stock history</Text>
      {(movements.data as unknown as { id: string; type: string; quantity_change: number; stock_after: number; created_at: string; reason: string | null }[] ?? []).map((m) => <Card key={m.id}><Text>{m.type} · {m.quantity_change > 0 ? '+' : ''}{m.quantity_change} → {m.stock_after}</Text><Sub>{new Date(m.created_at).toLocaleString()} {m.reason ?? ''}</Sub></Card>)}
    </ScrollView></Screen>
  );
}

export function CategoriesScreen() {
  const storeId = useSession((s) => s.store?.id) ?? ''; const qc = useQueryClient(); const [search, setSearch] = useState('');
  const cats = useQuery({ queryKey: ['cats', storeId], enabled: !!storeId, queryFn: () => categoryService.list(storeId) });
  const { control, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(categorySchema), defaultValues: { name: '' } });
  const [error, setError] = useState('');
  const filtered = (cats.data ?? []).filter((x) => x.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Screen>
      <Title>Categories</Title>{!!error && <ErrorBox message={error} />}
      <Field label="Search categories" value={search} onChangeText={setSearch} />
      <Controller control={control} name="name" render={({ field: { onChange, value } }) => <Field label="New category" value={value} onChangeText={onChange} error={errors.name?.message} />} />
      <Button title="Add category" onPress={handleSubmit(async (v) => { try { await categoryService.create(storeId, v.name.trim()); reset(); qc.invalidateQueries({ queryKey: ['cats'] }); } catch (e) { setError((e as Error).message); } })} />
      <Button title="View inventory movements" variant="ghost" onPress={() => router.push('/(tabs)/products/inventory')} />
      <FlatList data={filtered} keyExtractor={(x) => x.id} ListEmptyComponent={<EmptyState title="No categories" />}
        renderItem={({ item }) => <Card><Text style={{ fontWeight: '600' }}>{item.name}</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            <TouchableOpacity onPress={async () => { const name = await new Promise<string | null>((res) => { Alert.prompt?.('Rename category', 'New name', [{ text: 'Cancel', onPress: () => res(null) }, { text: 'Save', onPress: (t?: string) => res(t ?? null) }], 'plain-text', item.name); if (!Alert.prompt) res(null); }); if (name) { await categoryService.update(item.id, name); qc.invalidateQueries({ queryKey: ['cats'] }); } }}><Text style={{ color: '#2563EB' }}>Rename</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Delete category?', 'This is blocked if products still use it.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await categoryService.remove(item.id); qc.invalidateQueries({ queryKey: ['cats'] }); } catch (e) { setError((e as Error).message); } } }])}><Text style={{ color: '#DC2626' }}>Delete</Text></TouchableOpacity>
          </View></Card>} />
    </Screen>
  );
}

export function InventoryScreen() {
  const storeId = useSession((s) => s.store?.id) ?? '';
  const movements = useQuery({ queryKey: ['all-movements', storeId], enabled: !!storeId, queryFn: () => inventoryService.movements(storeId) });
  const products = useQuery({ queryKey: ['products', storeId], enabled: !!storeId, queryFn: () => productService.list(storeId, { activeOnly: false }) });
  const low = (products.data ?? []).filter((p) => isLowStock(p.stock_quantity, p.low_stock_threshold));
  return (
    <Screen>
      <Title>Inventory</Title>
      <Text style={{ fontWeight: '700', marginVertical: 6 }}>Low-stock alerts ({low.length})</Text>
      {low.length ? low.map((p) => <Card key={p.id}><Text>⚠ {p.name} — {p.stock_quantity} left (threshold {p.low_stock_threshold})</Text></Card>) : <Sub>No low-stock products. 🎉</Sub>}
      <Text style={{ fontWeight: '700', marginVertical: 6 }}>Recent stock movements</Text>
      {movements.isLoading ? <Loading /> : (
        <FlatList data={(movements.data as unknown as { id: string; type: string; quantity_change: number; stock_after: number; created_at: string; products?: { name: string } }[]) ?? []} keyExtractor={(m) => m.id}
          ListEmptyComponent={<EmptyState title="No movements yet" hint="Sales, stock-ins and adjustments appear here." />}
          renderItem={({ item }) => <Card><Text>{item.products?.name ?? 'Product'} · {item.type} {item.quantity_change > 0 ? '+' : ''}{item.quantity_change} → {item.stock_after}</Text><Sub>{new Date(item.created_at).toLocaleString()}</Sub></Card>} />)}
    </Screen>
  );
}
