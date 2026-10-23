import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { radius, spacing, usePalette, type Palette } from '@/theme/theme';

export const ACCENT = '#0A9BD8';
export const NAVY = '#0A2540';
export const fieldFill = (c: Palette) => (c.input === '#FFFFFF' ? '#F1F6FB' : c.input);

export function TopBar({ title, icon }: { title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }) {
  const c = useC();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialCommunityIcons name={icon} size={21} color={ACCENT} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginLeft: 7 }}>{title}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => Alert.alert('Notifications', 'No new notifications.')} style={{ marginRight: 14 }} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={22} color={c.text} />
          <View style={{ position: 'absolute', top: 1, right: 1, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings/profile')} accessibilityLabel="My profile">
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (t: string) => void; placeholder: string }) {
  const c = useC();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: fieldFill(c), borderWidth: 1, borderColor: c.border, borderRadius: 12, height: 48, paddingHorizontal: 13, marginVertical: 6 }}>
      <Ionicons name="search" size={19} color="#94A3B8" />
      <TextInput style={{ flex: 1, marginLeft: 9, fontSize: 15, color: c.text }} placeholder={placeholder} placeholderTextColor={c.sub} value={value} onChangeText={onChange} />
      {!!value && <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Clear search"><Ionicons name="close" size={18} color="#94A3B8" /></TouchableOpacity>}
    </View>
  );
}

export const useC = () => usePalette(useColorScheme() === 'dark');

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewProps['style'] }) {
  const c = useC();
  return <SafeAreaView style={[{ flex: 1, backgroundColor: c.bg }, style]}><View style={{ flex: 1, padding: spacing.md }}>{children}</View></SafeAreaView>;
}
export function Title({ children }: { children: React.ReactNode }) { const c = useC(); return <Text style={{ fontSize: 24, fontWeight: '700', color: c.text, marginBottom: spacing.sm }}>{children}</Text>; }
export function Sub({ children }: { children: React.ReactNode }) { const c = useC(); return <Text style={{ fontSize: 14, color: c.sub }}>{children}</Text>; }

export function Button({ title, onPress, variant = 'primary', disabled, loading }: { title: string; onPress?: () => void; variant?: 'primary' | 'danger' | 'ghost'; disabled?: boolean; loading?: boolean }) {
  const c = useC();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : 'transparent';
  const color = variant === 'ghost' ? c.primary : c.primaryText;
  return (
    <TouchableOpacity accessibilityRole="button" disabled={disabled || loading} onPress={onPress}
      style={{ backgroundColor: bg, opacity: disabled ? 0.5 : 1, paddingVertical: 13, paddingHorizontal: 16, borderRadius: radius.md, alignItems: 'center', marginVertical: 6, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: c.border }}>
      {loading ? <ActivityIndicator color={color} /> : <Text style={{ color, fontWeight: '600', fontSize: 16 }}>{title}</Text>}
    </TouchableOpacity>
  );
}
export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useC();
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={{ color: c.text, fontWeight: '500', marginBottom: 4 }}>{label}</Text>
      <TextInput placeholderTextColor={c.sub} {...props}
        style={{ borderWidth: 1, borderColor: error ? c.danger : c.border, backgroundColor: fieldFill(c), color: c.text, borderRadius: radius.md, padding: 12, fontSize: 16 }} />
      {!!error && <Text style={{ color: c.danger, marginTop: 4, fontSize: 13 }}>{error}</Text>}
    </View>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewProps['style'] }) {
  const c = useC();
  return <View style={[{ backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.md, marginVertical: 6, borderWidth: 1, borderColor: c.border }, style]}>{children}</View>;
}
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const c = useC();
  return <View style={{ alignItems: 'center', padding: 32 }}><Text style={{ fontSize: 17, fontWeight: '600', color: c.text }}>{title}</Text>{hint ? <Text style={{ color: c.sub, textAlign: 'center', marginTop: 6 }}>{hint}</Text> : null}</View>;
}
export function Loading() { return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" /></View>; }
export function ErrorBox({ message }: { message: string }) { const c = useC(); return <View style={{ backgroundColor: '#FEF2F2', borderColor: c.danger, borderWidth: 1, borderRadius: radius.md, padding: 12, marginVertical: 8 }}><Text style={{ color: c.danger }}>{message}</Text></View>; }
export function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const c = useC();
  return <Card style={{ flex: 1, marginHorizontal: 4 }}><Text style={{ color: c.sub, fontSize: 13 }}>{label}</Text><Text style={{ color: warn ? c.warn : c.text, fontSize: 20, fontWeight: '700', marginTop: 4 }}>{value}</Text></Card>;
}
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const c = useC();
  return <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginRight: 8, backgroundColor: active ? c.primary : c.card, borderWidth: 1, borderColor: c.border }}><Text style={{ color: active ? '#fff' : c.text, fontWeight: '500' }}>{label}</Text></TouchableOpacity>;
}
export const row = StyleSheet.create({ r: { flexDirection: 'row', alignItems: 'center' } }).r;
export type { Palette };
