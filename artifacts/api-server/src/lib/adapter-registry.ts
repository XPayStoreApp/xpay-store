import { ProviderAdapter } from "./provider-adapters";
import { MersalAdapter } from "./mersal-adapter";

const adapters: Map<string, ProviderAdapter> = new Map();

// تسجيل المحولات
export function registerAdapters() {
  const mersal = new MersalAdapter();
  adapters.set(mersal.name, mersal);
  // يمكن إضافة محولات أخرى هنا مستقبلاً
}

export function getAdapter(type: string): ProviderAdapter | undefined {
  if (adapters.size === 0) registerAdapters();
  return adapters.get(type);
}

export function listAdapterTypes(): string[] {
  if (adapters.size === 0) registerAdapters();
  return Array.from(adapters.keys());
}