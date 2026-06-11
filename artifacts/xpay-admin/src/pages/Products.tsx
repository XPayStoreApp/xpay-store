import { useEffect, useState } from "react";
import Crud from "../components/Crud";
import { get } from "../lib/api";

const preciseDecimalPattern = /^\d+(\.\d{1,12})?$/;

function cleanDecimal(value: unknown): string {
  return String(value ?? "").trim();
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function finalUnitPrice(row: any): number {
  return asNumber(row.finalUnitPrice ?? asNumber(row.providerUnitPrice ?? row.basePriceUsd) + asNumber(row.storeProfitPerUnit ?? row.priceUsd));
}

function PreviewTotals({ row }: { row: any }) {
  const min = Math.max(1, Math.floor(asNumber(row.minQuantity ?? row.minQty ?? 1)));
  const maxRaw = row.maxQuantity ?? row.maxQty;
  const max = maxRaw == null || maxRaw === "" ? min : Math.max(min, Math.floor(asNumber(maxRaw)));
  const mid = Math.floor((min + max) / 2);
  const unit = finalUnitPrice(row);
  const rows = [
    { label: "أقل كمية", quantity: min },
    { label: "منتصف المدى", quantity: mid },
    { label: "أعلى كمية", quantity: max },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 text-sm font-bold text-slate-800">معاينة السعر الإجمالي</div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-right">النوع</th>
              <th className="px-3 py-2 text-right">الكمية</th>
              <th className="px-3 py-2 text-right">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.label} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.label}</td>
                <td className="px-3 py-2 font-mono">{item.quantity}</td>
                <td className="px-3 py-2 font-mono">${(unit * item.quantity).toFixed(8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
        `تكلفة المزود الحالية: ${result.remote?.priceUsd ?? "-"}`,
        `تكلفة المزود المخزنة: ${result.product?.localBaseCostUsd ?? "-"}`,
        `ربح المتجر: ${result.product?.localMarkupUsd ?? "-"}`,
        `سعر الوحدة النهائي: ${result.product?.localFinalPriceUsd ?? "-"}`,
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
    payload.storeProfitPerUnit = cleanDecimal(payload.storeProfitPerUnit ?? payload.priceUsd);
    payload.priceUsd = payload.storeProfitPerUnit;
    payload.basePriceUsd = cleanDecimal(payload.basePriceUsd);
    payload.providerUnitPrice = cleanDecimal(payload.providerUnitPrice ?? payload.basePriceUsd);

    if (!preciseDecimalPattern.test(payload.storeProfitPerUnit)) {
      throw new Error("ربح المتجر لكل وحدة يجب أن يكون رقمًا موجبًا ويدعم حتى 12 رقمًا بعد الفاصلة.");
    }

    if (payload.providerUnitPrice && !preciseDecimalPattern.test(payload.providerUnitPrice)) {
      throw new Error("سعر المزود يجب أن يكون رقمًا موجبًا.");
    }

    const min = asNumber(payload.minQuantity ?? payload.minQty ?? 1);
    const max = payload.maxQuantity ?? payload.maxQty;
    if (max != null && max !== "" && asNumber(max) < min) {
      throw new Error("أعلى كمية يجب أن تكون أكبر من أو تساوي أقل كمية.");
    }

    if (!payload.basePriceUsd) payload.basePriceUsd = payload.providerUnitPrice || null;
    if (!payload.providerUnitPrice) payload.providerUnitPrice = payload.basePriceUsd || null;

    return payload;
  };

  return (
    <Crud
      resource="products"
      title="المنتجات"
      beforeSubmit={normalizeProductPayload}
      renderFormExtra={(row) => <PreviewTotals row={row} />}
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
          name: "providerUnitPrice",
          label: "سعر الوحدة من المزود",
          type: "text",
          readOnly: true,
          helperText: "يتم تحديثه من API المزود ولا يعدل يدويًا.",
        },
        {
          name: "storeProfitPerUnit",
          label: "ربح المتجر لكل وحدة",
          type: "text",
          placeholder: "مثال: 0.00011",
          required: true,
          helperText: "هذا هو الربح اليدوي لكل وحدة. سعر الوحدة النهائي = سعر المزود + هذا الربح.",
        },
        {
          name: "finalUnitPrice",
          label: "سعر الوحدة النهائي",
          type: "text",
          readOnly: true,
          helperText: "يحسب تلقائيًا: سعر المزود + ربح المتجر.",
        },
        {
          name: "minQuantity",
          label: "أقل كمية من المزود",
          type: "number",
          readOnly: true,
        },
        {
          name: "quantityType",
          label: "نوع الكمية",
          type: "select",
          readOnly: true,
          options: [
            { value: "fixed", label: "ثابتة" },
            { value: "range", label: "مدى" },
            { value: "list", label: "قائمة" },
          ],
        },
        {
          name: "maxQuantity",
          label: "أعلى كمية مسموحة",
          type: "number",
          step: "1",
          helperText: "يحدده الأدمن ويجب أن يكون أكبر من أو يساوي أقل كمية.",
        },
        {
          name: "priceSyp",
          label: "سعر الليرة للعرض الداخلي فقط",
          type: "number",
          step: "0.01",
          required: true,
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
        { name: "priceUsd", label: "ربح قديم للتوافق", type: "text", hideInTable: true },
        { name: "basePriceUsd", label: "تكلفة مزود قديمة للتوافق", type: "text", hideInTable: true },
        { name: "minQty", label: "أقل كمية قديمة للتوافق", type: "number", hideInTable: true },
        { name: "maxQty", label: "أعلى كمية قديمة للتوافق", type: "number", hideInTable: true },
      ]}
    />
  );
}
