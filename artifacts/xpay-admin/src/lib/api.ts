const BASE_URL = import.meta.env.VITE_API_URL || "";
const BASE = `${BASE_URL}/api/admin`;

export async function api<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const url = `${BASE}${path}`;
  console.log(`🚀 API Request: ${opts.method || "GET"} ${url}`, opts.body || "");

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });

  console.log(`📥 API Response: ${res.status} ${res.statusText} for ${url}`);

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    console.error(`❌ API Error: ${msg}`);
    throw new Error(msg);
  }

  console.log(`✅ API Success:`, data);
  return data as T;
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "POST", body: JSON.stringify(body || {}) });
export const put = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "PUT", body: JSON.stringify(body || {}) });
export const patch = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "PATCH", body: JSON.stringify(body || {}) });
export const del = <T = any>(p: string) => api<T>(p, { method: "DELETE" });