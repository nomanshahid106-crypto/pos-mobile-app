import { Tabs } from 'expo-router';
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="pos/index" options={{ title: 'Sell' }} />
      <Tabs.Screen name="products/index" options={{ title: 'Products' }} />
      <Tabs.Screen name="sales/index" options={{ title: 'Sales' }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />
      {/* Hidden detail routes */}
      <Tabs.Screen name="products/[id]" options={{ href: null, title: 'Product' }} />
      <Tabs.Screen name="products/new" options={{ href: null, title: 'New Product' }} />
      <Tabs.Screen name="products/categories" options={{ href: null, title: 'Categories' }} />
      <Tabs.Screen name="products/inventory" options={{ href: null, title: 'Inventory' }} />
      <Tabs.Screen name="sales/[id]" options={{ href: null, title: 'Sale Detail' }} />
      <Tabs.Screen name="sales/receipt/[id]" options={{ href: null, title: 'Receipt' }} />
      <Tabs.Screen name="pos/checkout" options={{ href: null, title: 'Checkout' }} />
      <Tabs.Screen name="settings/profile" options={{ href: null, title: 'Profile' }} />
    </Tabs>
  );
}
