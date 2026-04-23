import { ProviderAdapter, ProviderProduct, ProviderOrderResult, ProviderCheckResult } from "./provider-adapters";

const DEFAULT_API_URL = "https://api.mersal-card.com";

export class MersalAdapter implements ProviderAdapter {
  name = "mersal";

  private getUrl(apiUrl?: string): string {
    return apiUrl || DEFAULT_API_URL;
  }

  async getProfile(apiKey: string, apiUrl?: string): Promise<any> {
    const res = await fetch(`${this.getUrl(apiUrl)}/client/api/profile`, {
      headers: { "api-token": apiKey },
    });
    if (!res.ok) throw new Error(`Mersal profile error: ${res.status}`);
    return res.json();
  }

  async fetchProducts(apiKey: string, apiUrl?: string): Promise<ProviderProduct[]> {
    const res = await fetch(`${this.getUrl(apiUrl)}/client/api/products`, {
      headers: { "api-token": apiKey },
    });
    if (!res.ok) throw new Error(`Mersal products error: ${res.status}`);
    
    const data = await res.json() as any[];
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      basePrice: p.base_price,
      categoryName: p.category_name,
      categoryImage: p.category_img,
      available: p.available,
      minQty: p.qty_values?.min,
      maxQty: p.qty_values?.max,
      productType: p.product_type,
      description: p.params?.join(", "),
      rawData: p,
    }));
  }

  async placeOrder(
    apiKey: string,
    apiUrl: string | undefined,
    productId: number | string,
    quantity: number,
    playerId: string,
    orderUuid: string,
    extraParams?: Record<string, string>
  ): Promise<ProviderOrderResult> {
    const url = new URL(`${this.getUrl(apiUrl)}/client/api/newOrder/${productId}/params`);
    url.searchParams.set("qty", quantity.toString());
    url.searchParams.set("playerId", playerId);
    url.searchParams.set("order_uuid", orderUuid);
    
    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: { "api-token": apiKey },
    });
    
    if (!res.ok) {
      const text = await res.text();
      return { success: false, status: "error", error: `HTTP ${res.status}: ${text}` };
    }
    
    const data = await res.json();
    return {
      success: data.status === "OK",
      providerOrderId: data.data?.order_id,
      status: data.data?.status || "wait",
      price: data.data?.price,
      rawResponse: data,
      replayApi: data.data?.replay_api,
    };
  }

  async checkOrders(
    apiKey: string,
    apiUrl: string | undefined,
    orderIds: string[],
    byUuid?: boolean
  ): Promise<ProviderCheckResult> {
    const idsParam = orderIds.join(",");
    const url = new URL(`${this.getUrl(apiUrl)}/client/api/check`);
    url.searchParams.set("orders", `[${idsParam}]`);
    if (byUuid) url.searchParams.set("uuid", "1");

    const res = await fetch(url.toString(), {
      headers: { "api-token": apiKey },
    });
    if (!res.ok) throw new Error(`Mersal check error: ${res.status}`);
    
    const data = await res.json();
    return {
      orders: (data.data || []).map((o: any) => ({
        providerOrderId: o.order_id,
        status: o.status,
        quantity: o.quantity,
        replayApi: o.replay_api,
        rawData: o,
      })),
    };
  }
}