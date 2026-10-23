import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Button, ErrorBox, Field, Screen, Sub, Title, TopBar } from '@/components/ui';
import { authService, settingsService } from '@/services';
import { useSession } from '@/store/appStore';
import { settingsSchema } from '@/validation/schemas';
import { useThemeMode } from '@/theme/theme';

export default function SettingsScreen() {
  const store = useSession((s) => s.store); const role = useSession((s) => s.role); const setSession = useSession((s) => s.setSession);
  const canEdit = role === 'owner' || role === 'manager';
  const theme = useThemeMode();
  const [storeName, setStoreName] = useState(store?.name ?? ''); const [address, setAddress] = useState(store?.address ?? ''); const [phone, setPhone] = useState(store?.phone ?? '');
  const [msg, setMsg] = useState(''); const [error, setError] = useState('');
  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: { currency: 'USD', taxRatePercent: 0, defaultLowStockThreshold: 5, cashierMaxDiscountPercent: 0, maxDiscountPercent: 100, receiptFooter: 'Thank you for your business!', allowNegativeStock: false },
  });
  useEffect(() => { if (store?.id) settingsService.get(store.id).then((s) => reset({ currency: s.currency, taxRatePercent: Number(s.tax_rate) * 100, defaultLowStockThreshold: s.default_low_stock_threshold, cashierMaxDiscountPercent: Number(s.cashier_max_discount_percent), maxDiscountPercent: Number(s.max_discount_percent), receiptFooter: s.receipt_footer, allowNegativeStock: s.allow_negative_stock })).catch((e) => setError((e as Error).message)); }, [store?.id]);
  return (
    <Screen><ScrollView keyboardShouldPersistTaps="handled">
      <TopBar title="Settings" icon="cog-outline" />
      <Title>Store settings</Title><Sub>{store?.name} · Your role: {role}</Sub>
      {!!error && <ErrorBox message={error} />}{!!msg && <Sub>{msg}</Sub>}
      <Field label="Store name" value={storeName} onChangeText={setStoreName} editable={role === 'owner'} />
      <Field label="Address" value={address} onChangeText={setAddress} editable={role === 'owner'} />
      <Field label="Phone" value={phone} onChangeText={setPhone} editable={role === 'owner'} />
      {role === 'owner' && <Button title="Save store details" onPress={async () => { await settingsService.updateStore(store!.id, { name: storeName, address, phone }); setSession({ store: { ...store!, name: storeName, address, phone } }); setMsg('Store details saved.'); }} />}
      <Controller control={control} name="currency" render={({ field: { onChange, value } }) => <Field label="Currency (ISO code, e.g. USD, PKR, EUR)" value={value} onChangeText={onChange} editable={canEdit} error={errors.currency?.message} />} />
      <Controller control={control} name="taxRatePercent" render={({ field: { onChange, value } }) => <Field label="Tax rate %" keyboardType="decimal-pad" value={String(value)} onChangeText={onChange} editable={canEdit} error={errors.taxRatePercent?.message} />} />
      <Controller control={control} name="defaultLowStockThreshold" render={({ field: { onChange, value } }) => <Field label="Default low-stock threshold" keyboardType="number-pad" value={String(value)} onChangeText={onChange} editable={canEdit} />} />
      <Controller control={control} name="cashierMaxDiscountPercent" render={({ field: { onChange, value } }) => <Field label="Cashier max discount %" keyboardType="decimal-pad" value={String(value)} onChangeText={onChange} editable={canEdit} />} />
      <Controller control={control} name="maxDiscountPercent" render={({ field: { onChange, value } }) => <Field label="Manager/owner max discount %" keyboardType="decimal-pad" value={String(value)} onChangeText={onChange} editable={canEdit} />} />
      <Controller control={control} name="receiptFooter" render={({ field: { onChange, value } }) => <Field label="Receipt footer / thank-you message" value={value} onChangeText={onChange} editable={canEdit} />} />
      <Controller control={control} name="allowNegativeStock" render={({ field: { onChange, value } }) => <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}><Text>Allow negative stock</Text><Switch value={!!value} onValueChange={onChange} disabled={!canEdit} /></View>} />
      {canEdit && <Button title="Save settings" loading={isSubmitting} onPress={handleSubmit(async (v) => { await settingsService.update(store!.id, { currency: v.currency.toUpperCase(), tax_rate: v.taxRatePercent / 100, default_low_stock_threshold: v.defaultLowStockThreshold, cashier_max_discount_percent: v.cashierMaxDiscountPercent, max_discount_percent: v.maxDiscountPercent, receipt_footer: v.receiptFooter, allow_negative_stock: v.allowNegativeStock }); const s = await settingsService.get(store!.id); setSession({ settings: s }); setMsg('Settings saved. Tax/currency now apply across POS and receipts.'); })} />}
      {!canEdit && <Sub>Only Owner/Manager can change settings.</Sub>}
      <Text style={{ fontWeight: '600', marginTop: 14 }}>Appearance</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginVertical: 6 }}>
        <Button title="Light" variant="ghost" onPress={() => theme.setMode('light')} /><Button title="Dark" variant="ghost" onPress={() => theme.setMode('dark')} /><Button title="System" variant="ghost" onPress={() => theme.setMode('system')} />
      </View>
      <Button title="My profile" variant="ghost" onPress={() => router.push('/(tabs)/settings/profile')} />
      <Button title="Sign out" variant="danger" onPress={() => authService.signOut()} />
    </ScrollView></Screen>
  );
}
