import { useEffect, useMemo, useState } from "react";
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

function resolveProviderUnitPrice(row: any): number {
  return asNumber(row.providerUnitPrice ?? row.basePriceUsd);
}

function calculateFinalUnitPrice(row: any): number {
  const explicitFinal = row.finalUnitPrice;
  if (explicitFinal !== null && explicitFinal !== undefined && String(explicitFinal).trim() !== "") {
    return asNumber(explicitFinal);
  }
  return resolveProviderUnitPrice(row) + asNumber(row.storeProfitPerUnit ?? row.priceUsd);
}

function resolveProfitPerUnit(row: any): number {
  return Math.max(0, calculateFinalUnitPrice(row) - resolveProviderUnitPrice(row));
}

function formatMoney(value: number): string {
  return value.toFixed(8);
}

function PreviewTotals({ row }: { row: any }) {
  const min = Math.max(1, Math.floor(asNumber(row.minQuantity ?? row.minQty ?? 1)));
  const maxRaw = row.maxQuantity ?? row.maxQty;
  const max = maxRaw == null || maxRaw === "" ? min : Math.max(min, Math.floor(asNumber(maxRaw)));
  const mid = Math.floor((min + max) / 2);
  const providerUnit = resolveProviderUnitPrice(row);
  const finalUnit = calculateFinalUnitPrice(row);
  const profitUnit = resolveProfitPerUnit(row);
  const rows = [
    { label: "أقل كمية", quantity: min },
    { label: "منتصف المدى", quantity: mid },
    { label: "أعلى كمية", quantity: max },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-bold text-slate-800">معاينة السعر قبل الحفظ</div>
      <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="text-slate-500">سعر المزود للوحدة</div>
          <div className="font-mono font-bold">${formatMoney(providerUnit)}</div>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="text-slate-500">سعر البيع النهائي للوحدة</div>
          <div className="font-mono font-bold text-blue-700">${formatMoney(finalUnit)}</div>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="text-slate-500">الربح المحسوب للوحدة</div>
          <div className="font-mono font-bold">${formatMoney(profitUnit)}</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-right">النوع</th>
              <th className="px-3 py-2 text-right">الكمية</th>
              <th className="px-3 py-2 text-right">السعر الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.label} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.label}</td>
                <td className="px-3 py-2 font-mono">{item.quantity}</td>
                <td className="px-3 py-2 font-mono">${formatMoney(finalUnit * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-6 text-slate-500">
        عدل سعر البيع النهائي مباشرة. الخادم سيحسب الربح تلقائيا = سعر البيع النهائي - سعر المزود، ولن يضيف سعر المزود مرة ثانية.
      </p>
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

  const categoryOptions = useMemo(
    () => (categories.length > 0 ? categories : [{ value: "", label: "لا توجد فئات" }]),
    [categories],
  );
  const providerOptions = useMemo(
    () => (providers.length > 0 ? providers : [{ value: "", label: "لا يوجد مزودون" }]),
    [providers],
  );

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
        `سعر المزود الحالي: ${result.remote?.priceUsd ?? "-"}`,
        `سعر المزود المخزن: ${result.product?.localBaseCostUsd ?? "-"}`,
        `الربح المحسوب للوحدة: ${result.product?.localMarkupUsd ?? "-"}`,
        `سعر البيع النهائي للوحدة: ${result.product?.localFinalPriceUsd ?? "-"}`,
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
    payload.basePriceUsd = cleanDecimal(payload.basePriceUsd);
    payload.providerUnitPrice = cleanDecimal(payload.providerUnitPrice ?? payload.basePriceUsd);
    payload.finalUnitPrice = cleanDecimal(payload.finalUnitPrice);

    if (!preciseDecimalPattern.test(payload.finalUnitPrice)) {
      throw new Error("سعر البيع النهائي لكل وحدة يجب أن يكون رقما موجبا ويدعم حتى 12 رقما بعد الفاصلة.");
    }

    if (payload.providerUnitPrice && !preciseDecimalPattern.test(payload.providerUnitPrice)) {
      throw new Error("سعر المزود يجب أن يكون رقما موجبا.");
    }

    const providerUnit = asNumber(payload.providerUnitPrice || payload.basePriceUsd || 0);
    const finalUnit = asNumber(payload.finalUnitPrice);
    if (finalUnit < providerUnit) {
      throw new Error("سعر البيع النهائي يجب أن يكون أكبر من أو يساوي سعر المزود.");
    }

    payload.storeProfitPerUnit = (finalUnit - providerUnit).toFixed(8);
    payload.priceUsd = payload.storeProfitPerUnit;

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
          options: categoryOptions,
        },
        { name: "name", label: "اسم المنتج", type: "text", required: true },
        { name: "image", label: "رابط الصورة", type: "text", required: true },
        {
          name: "providerUnitPrice",
          label: "سعر المزود لكل وحدة",
          type: "text",
          readOnly: true,
          helperText: "يتم تحديثه من API المزود ولا يعدل يدويا.",
        },
        {
          name: "finalUnitPrice",
          label: "سعر البيع النهائي لكل وحدة",
          type: "text",
          placeholder: "مثال: 0.00011000",
          required: true,
          helperText: "اكتب هنا السعر النهائي الذي سيدفعه العميل لكل وحدة. لا تتم إضافة سعر المزود فوقه مرة أخرى.",
        },
        {
          name: "storeProfitPerUnit",
          label: "الربح المحسوب لكل وحدة",
          type: "text",
          readOnly: true,
          helperText: "يحسب تلقائيا من سعر البيع النهائي ناقص سعر المزود ويحفظ للتوافق الداخلي.",
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
          options: providerOptions,
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
