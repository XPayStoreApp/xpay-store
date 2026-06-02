export async function getPublicJson<T>(path: string): Promise<T> {
  const baseUrl = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const separator = path.includes("?") ? "&" : "?";
  const url = `${baseUrl}/api${path}${separator}_=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`public_api_${response.status}`);
  }

  return response.json() as Promise<T>;
}
