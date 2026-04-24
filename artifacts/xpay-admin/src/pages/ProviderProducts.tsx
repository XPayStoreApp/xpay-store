import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { get } from "../lib/api";
import { Copy, Check, ArrowLeft } from "lucide-react";

interface ProviderProduct {
  id: number;
  name: string;
  price: number;
  category: string;
}

export default function ProviderProducts() {
  const { id } = useParams<{ id: string }>(); // استقبال id من الرابط
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProviderProduct[]>([]);
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
        const data = await get<{ provider: string; products: ProviderProduct[] }>(
          `/providers/${id}/products`
        );
        setProducts(data.products || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [id]);

  const copyToClipboard = (text: number) => {
    navigator.clipboard.writeText(String(text)).then(() => {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate("/providers")}
          className="flex items-center gap-1 text-brand-600 hover:underline"
        >
          <ArrowLeft size={16} /> العودة للمزودين
        </button>
        <h1 className="text-2xl font-bold text-slate-900">منتجات المزود</h1>
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
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      لا توجد منتجات
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-brand-700">{p.id}</td>
                      <td className="px-4 py-3">{p.name}</td>
                      <td className="px-4 py-3 text-slate-500">{p.category}</td>
                      <td className="px-4 py-3 font-medium">
                        {p.price.toFixed(4)} USD
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => copyToClipboard(p.id)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 rounded"
                          title="نسخ المعرف"
                        >
                          {copiedId === p.id ? (
                            <Check size={16} className="text-emerald-500" />
                          ) : (
                            <Copy size={16} />
                          )}
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