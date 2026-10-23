import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT } from '@/components/ui';

const INACTIVE = '#7C8DA6';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: ACCENT,
      tabBarInactiveTintColor: INACTIVE,
      tabBarStyle: { height: 62, paddingTop: 6, paddingBottom: 8, borderTopColor: '#E2E8F0' },
      tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="pos/index" options={{ title: 'Sell', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cash-register" size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="products/index" options={{ title: 'Products', tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="sales/index" options={{ title: 'Sales', tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size ?? 22} color={color} /> }} />
      {/* Hidden detail routes (keep native header for back navigation) */}
      <Tabs.Screen name="products/[id]" options={{ href: null, title: 'Product', headerShown: true }} />
      <Tabs.Screen name="products/new" options={{ href: null, title: 'New Product', headerShown: true }} />
      <Tabs.Screen name="products/categories" options={{ href: null, title: 'Categories', headerShown: true }} />
      <Tabs.Screen name="products/inventory" options={{ href: null, title: 'Inventory', headerShown: true }} />
      <Tabs.Screen name="sales/[id]" options={{ href: null, title: 'Sale Detail', headerShown: true }} />
      <Tabs.Screen name="sales/receipt/[id]" options={{ href: null, title: 'Receipt', headerShown: true }} />
      <Tabs.Screen name="pos/checkout" options={{ href: null, title: 'Checkout', headerShown: true }} />
      <Tabs.Screen name="settings/profile" options={{ href: null, title: 'Profile', headerShown: true }} />
    </Tabs>
  );
}
