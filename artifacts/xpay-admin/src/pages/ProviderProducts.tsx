import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { get } from "../lib/api";
import { Copy, Check, ArrowLeft, Search } from "lucide-react";

interface ProviderProduct {
  id: number;
  name: string;
  price: number;
  category: string;
}

export default function ProviderProducts() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<ProviderProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (!id || id === "undefined") {
      setError("معرف المزود غير صالح. الرجاء العودة واختيار مزود.");
      setLoading(false);
      return;
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await get<{ provider: string; products: ProviderProduct[] }>(`/providers/${id}/products`);
        setProducts(data.products || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [id]);

  useEffect(() => {
    if (searchParams.get("search") === "1") {
      const el = document.getElementById("provider-products-search") as HTMLInputElement | null;
      if (el) setTimeout(() => el.focus(), 80);
    }
  }, [searchParams]);

  const copyToClipboard = (text: number) => {
    navigator.clipboard.writeText(String(text)).then(() => {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.id).toLowerCase().includes(q) ||
      String(p.name || "").toLowerCase().includes(q) ||
      String(p.category || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate("/providers")} className="flex items-center gap-1 text-brand-600 hover:underline">
          <ArrowLeft size={16} /> العودة للمزودين
        </button>
        <h1 className="text-2xl font-bold text-slate-900">منتجات المزود</h1>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id="provider-products-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث عن منتج (ID / الاسم / الفئة)"
          className="w-full border border-slate-300 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {loading && <div className="text-center py-8 text-slate-400">جاري التحميل...</div>}
      {error && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-right px-4 py-3 font-semibold">المعرف (ID)</th>
                  <th className="text-right px-4 py-3 font-semibold">الاسم</th>
                  <th className="text-right px-4 py-3 font-semibold">الفئة</th>
                  <th className="text-right px-4 py-3 font-semibold">السعر (USD)</th>
                  <th className="text-center px-4 py-3 font-semibold">نسخ</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      لا توجد منتجات
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-brand-700">{p.id}</td>
                      <td className="px-4 py-3">{p.name}</td>
                      <td className="px-4 py-3 text-slate-500">{p.category}</td>
                      <td className="px-4 py-3 font-medium">{Number(p.price || 0).toFixed(4)} USD</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => copyToClipboard(p.id)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 rounded"
                          title="نسخ المعرف"
                        >
                          {copiedId === p.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
