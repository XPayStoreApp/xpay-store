import { useState, useEffect } from "react";
import Crud from "../components/Crud";
import { get } from "../lib/api";

const preciseDecimalPattern = /^\d+(\.\d{1,12})?$/;

function cleanDecimal(value: unknown): string {
  return String(value ?? "").trim();
}

export default function Products() {
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [providers, setProviders] = useState<{ value: string; label: string }[]>([]);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [cats, provs] = await Promise.all([get<any[]>("/categories"), get<any[]>("/providers")]);

        if (Array.isArray(cats)) {
          setCategories(cats.map((c: any) => ({ value: String(c.id), label: `${c.id} - ${c.name}` })));
        }
        if (Array.isArray(provs)) {
          setProviders(provs.map((p: any) => ({ value: String(p.id), label: `${p.id} - ${p.name}` })));
        }
      } catch (err) {
        console.error("Error fetching product references:", err);
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
        `موجود لدى المزود: ${result.existsAtProvider ? "نعم" : "لا"}`,
        `المزود: ${result.provider?.name ?? "-"}`,
        `رابط API: ${result.provider?.apiUrl ?? "-"}`,
        `تكلفة المزود الحالية: ${result.remote?.priceUsd ?? "-"}`,
        `تكلفة المزود المخزنة: ${result.product?.localBaseCostUsd ?? "-"}`,
        `ربح لوحة التحكم: ${result.product?.localMarkupUsd ?? "-"}`,
        `سعر البيع النهائي: ${result.product?.localFinalPriceUsd ?? "-"}`,
        `رسالة التحقق: ${result.message ?? "-"}`,
      ];
      alert(lines.join("\n"));
    } catch (err: any) {
      alert(`فشل التحقق: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const normalizeProductPayload = (data: any) => {
    const payload = { ...data };
    payload.priceUsd = cleanDecimal(payload.priceUsd);
    payload.basePriceUsd = cleanDecimal(payload.basePriceUsd);

    if (!preciseDecimalPattern.test(payload.priceUsd)) {
      throw new Error("ربح المتجر بالدولار يجب أن يكون رقمًا موجبًا ويدعم حتى 12 رقمًا بعد الفاصلة.");
    }

    if (payload.basePriceUsd && !preciseDecimalPattern.test(payload.basePriceUsd)) {
      throw new Error("تكلفة المزود يجب أن تكون رقمًا موجبًا ويدعم حتى 12 رقمًا بعد الفاصلة.");
    }

    if (!payload.basePriceUsd) {
      payload.basePriceUsd = null;
    }

    return payload;
  };

  return (
    <Crud
      resource="products"
      title="المنتجات"
      beforeSubmit={normalizeProductPayload}
      rowExtras={(row) => (
        <button
          onClick={() => verifyProviderProduct(row)}
          disabled={verifyingId === row.id}
          className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
          title="تحقق من سعر المنتج وتوفره عند المزود"
        >
          {verifyingId === row.id ? "جاري التحقق..." : "تحقق"}
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
        {
          name: "priceUsd",
          label: "ربح المتجر بالدولار (USD)",
          type: "text",
          placeholder: "مثال: 0.000000000021 أو 0.1",
          required: true,
          helperText:
            "هذا الرقم يدوي بالكامل ولا يأخذه المزود. للمنتجات المرتبطة بمزود: سعر البيع النهائي = تكلفة المزود الحالية + هذا الربح.",
        },
        {
          name: "priceSyp",
          label: "سعر الليرة للعرض الداخلي فقط (SYP)",
          type: "number",
          step: "0.01",
          required: true,
          helperText: "لا يظهر للمستخدم في المتجر. اتركه 0 إذا كان المنتج يعتمد على الدولار فقط.",
        },
        {
          name: "basePriceUsd",
          label: "تكلفة المزود بالدولار (تلقائي)",
          type: "text",
          placeholder: "يتم تحديثها تلقائيًا من API المزود",
          helperText:
            "هذا الحقل هو تكلفة المزود فقط. عند اختيار مزود ومعرف منتج سيتم جلبه وتحديثه تلقائيًا، ولا يغيّر ربح المتجر.",
        },
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
        { name: "minQty", label: "أقل كمية", type: "number", step: "0.01" },
        { name: "maxQty", label: "أقصى كمية", type: "number", step: "0.01" },
        { name: "description", label: "الوصف", type: "textarea" },
        { name: "featured", label: "مميز", type: "boolean", default: false },
        {
          name: "providerId",
          label: "المزود",
          type: "select",
          options: providers.length > 0 ? providers : [{ value: "", label: "لا يوجد مزودون" }],
        },
        { name: "providerProductId", label: "معرف المنتج لدى المزود", type: "number" },
        { name: "source", label: "المصدر", type: "text", default: "manual" },
      ]}
    />
  );
}
