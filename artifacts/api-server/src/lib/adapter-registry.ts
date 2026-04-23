import { ProviderAdapter } from "./provider-adapters";
import { MersalAdapter } from "./mersal-adapter";

const adapters: Map<string, ProviderAdapter> = new Map();

export function registerAdapters() {
  // تفادي التسجيل المتكرر
  if (adapters.size > 0) return;
  
  // تسجيل المحولات
  const mersal = new MersalAdapter();
  adapters.set("mersal", mersal);
  
  console.log("✅ [AdapterRegistry] Registered adapters:", Array.from(adapters.keys()));
}

export function getAdapter(type: string | undefined | null): ProviderAdapter | undefined {
  registerAdapters();
  
  // إذا كان النوع غير موجود، استخدم "custom" كافتراضي (لكنه لن يعمل للمزامنة)
  const key = (type || "").toLowerCase().trim();
  console.log(`🔍 [AdapterRegistry] Looking for adapter: type="${type}" -> key="${key}"`);
  
  const adapter = adapters.get(key);
  if (!adapter) {
    console.error(`❌ [AdapterRegistry] No adapter found for key: "${key}". Available: ${Array.from(adapters.keys()).join(", ")}`);
  } else {
    console.log(`✅ [AdapterRegistry] Found adapter for key: "${key}"`);
  }
  
  return adapter;
}

export function listAdapterTypes(): string[] {
  registerAdapters();
  return Array.from(adapters.keys());
}