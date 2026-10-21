import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ProductFormScreen } from '@/screens/products/ProductScreens';
import { productService } from '@/services';
import { Loading, Screen } from '@/components/ui';
import type { Product } from '@/types/database.types';
export default function NewProductRoute() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const q = useQuery({ queryKey: ['product-edit', edit], enabled: !!edit, queryFn: () => productService.get(edit!) as unknown as Promise<Product> });
  if (edit && q.isLoading) return <Screen><Loading /></Screen>;
  return <ProductFormScreen existing={q.data} />;
}
