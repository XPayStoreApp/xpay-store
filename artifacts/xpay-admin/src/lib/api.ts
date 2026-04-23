const BASE = `/api/admin`;

export async function api<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
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
