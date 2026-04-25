import { useState, useEffect } from "react";
import Crud from "../components/Crud";
import { get } from "../lib/api";

export default function Products() {
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [providers, setProviders] = useState<{ value: string; label: string }[]>([]);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  // جلب قائمة الفئات والمزودين لاستخدامها في الحقول المرتبطة
  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [cats, provs] = await Promise.all([
          get<any[]>("/categories"),
          get<any[]>("/providers"),
        ]);

        if (Array.isArray(cats)) {
          setCategories(cats.map((c: any) => ({ value: String(c.id), label: `${c.id} - ${c.name}` })));
        }
        if (Array.isArray(provs)) {
          setProviders(provs.map((p: any) => ({ value: String(p.id), label: `${p.id} - ${p.name}` })));
        }
      } catch (err) {
        console.error("Error fetching references:", err);
      }
    };
    fetchRefs();
  }, []);

  const verifyProviderProduct = async (row: any) => {
    try {
      setVerifyingId(row.id);
      const result = await get<any>(`/products/${row.id}/provider-status`);
      const lines = [
        `المنتج: ${row.name} (#${row.id})`,
        `النوع: ${result.type}`,
        `المصدر المحلي: ${result.product?.source ?? "-"}`,
        `هل موجود عند المزوّد: ${result.existsAtProvider ? "نعم" : "لا"}`,
        `المزوّد: ${result.provider?.name ?? "-"}`,
        `رابط API: ${result.provider?.apiUrl ?? "-"}`,
        `هل المصدر هو api.mersal-card.com: ${result.provider?.isMersalHost ? "نعم" : "لا"}`,
        `رسالة التحقق: ${result.message ?? "-"}`,
      ];
      alert(lines.join("\n"));
    } catch (err: any) {
      alert(`فشل التحقق: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <Crud
      resource="products"
      title="المنتجات"
      rowExtras={(row) => (
        <button
          onClick={() => verifyProviderProduct(row)}
          disabled={verifyingId === row.id}
          className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
          title="تحقق من المنتج عند المزوّد"
        >
          {verifyingId === row.id ? "جارٍ التحقق..." : "تحقق"}
        </button>
      )}
      fields={[
        {
          name: "categoryId",
          label: "الفئة",
          type: "select",
          required: false,
          options: categories.length > 0 ? categories : [{ value: "", label: "لا توجد فئات" }],
        },
        { name: "name", label: "اسم المنتج", type: "text", required: true },
        { name: "image", label: "رابط الصورة", type: "text", required: true },
        { name: "priceUsd", label: "السعر (USD)", type: "number", step: "0.0001", required: true },
        { name: "priceSyp", label: "السعر (SYP)", type: "number", step: "0.01", required: true },
        { name: "basePriceUsd", label: "سعر التكلفة (USD)", type: "number", step: "0.0001" },
        {
          name: "productType",
          label: "نوع المنتج",
          type: "select",
          options: [
            { value: "package", label: "باقة" },
            { value: "amount", label: "كمية" },
          ],
          default: "package",
        },
        { name: "available", label: "متاح", type: "boolean", default: true },
        { name: "minQty", label: "الحد الأدنى للكمية", type: "number", step: "0.01" },
        { name: "maxQty", label: "الحد الأقصى للكمية", type: "number", step: "0.01" },
        { name: "description", label: "الوصف", type: "textarea" },
        { name: "featured", label: "مميز", type: "boolean", default: false },
        {
          name: "providerId",
          label: "المزوّد",
          type: "select",
          options: providers.length > 0 ? providers : [{ value: "", label: "لا يوجد مزودون" }],
        },
        { name: "providerProductId", label: "معرف المنتج لدى المزود", type: "number" },
        { name: "source", label: "المصدر", type: "text", default: "manual" },
      ]}
    />
  );
}
