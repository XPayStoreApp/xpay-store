// واجهة موحدة لجميع المزودين
export interface ProviderAdapter {
    name: string;
    
    // جلب الملف الشخصي/الرصيد
    getProfile(apiKey: string, apiUrl?: string): Promise<any>;
    
    // جلب جميع المنتجات
    fetchProducts(apiKey: string, apiUrl?: string): Promise<ProviderProduct[]>;
    
    // تقديم طلب
    placeOrder(
      apiKey: string,
      apiUrl: string | undefined,
      productId: number | string,
      quantity: number,
      playerId: string,
      orderUuid: string,
      extraParams?: Record<string, string>
    ): Promise<ProviderOrderResult>;
    
    // التحقق من حالة طلب (أو عدة طلبات)
    checkOrders(
      apiKey: string,
      apiUrl: string | undefined,
      orderIds: string[],
      byUuid?: boolean
    ): Promise<ProviderCheckResult>;
  }
  
  export interface ProviderProduct {
    id: number | string;
    name: string;
    price: number;
    basePrice?: number;
    categoryName: string;
    categoryImage?: string;
    available: boolean;
    minQty?: number;
    maxQty?: number;
    productType: 'amount' | 'package';
    description?: string;
    rawData?: any; // لحفظ البيانات الأصلية
  }
  
  export interface ProviderOrderResult {
    success: boolean;
    providerOrderId?: string;
    status: string;
    price?: number;
    rawResponse?: any;
    replayApi?: any[];
    error?: string;
  }
  
  export interface ProviderCheckResult {
    orders: Array<{
      providerOrderId: string;
      status: string;
      quantity?: number;
      replayApi?: any[];
      rawData?: any;
    }>;
  }