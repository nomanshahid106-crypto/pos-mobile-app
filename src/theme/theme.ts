import { create } from 'zustand';
export const light = { bg: '#F6F9FC', card: '#FFFFFF', text: '#0F172A', sub: '#64748B', primary: '#0A9BD8', primaryText: '#FFFFFF', danger: '#DC2626', warn: '#D97706', success: '#059669', border: '#E2E8F0', input: '#FFFFFF' };
export const dark = { bg: '#0B1220', card: '#111827', text: '#F1F5F9', sub: '#94A3B8', primary: '#2FA8E8', primaryText: '#FFFFFF', danger: '#F87171', warn: '#FBBF24', success: '#34D399', border: '#1F2937', input: '#111827' };
export type Palette = typeof light;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 16 };
const useThemeStore = create<{ mode: 'light' | 'dark' | 'system'; setMode: (m: 'light' | 'dark' | 'system') => void }>((set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }));
export function usePalette(systemDark: boolean): Palette {
  const mode = useThemeStore((s) => s.mode);
  return (mode === 'dark' || (mode === 'system' && systemDark)) ? dark : light;
}
export const useThemeMode = useThemeStore;
