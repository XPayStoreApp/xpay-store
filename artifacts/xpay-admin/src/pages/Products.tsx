import { useState, useEffect } from "react";
import Crud from "../components/Crud";
import { get } from "../lib/api";

export default function Products() {
  const [providers, setProviders] = useState<{ value: string; label: string }[]>([]);

  // جلب قائمة المزودين لاستخدامها في حقل Provider
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const data = await get<any[]>("/providers");
        if (Array.isArray(data)) {
          setProviders(data.map((p: any) => ({ value: String(p.id), label: p.name })));
        }
      } catch (err) {
        console.error("Error fetching providers:", err);
      }
    };
    fetchProviders();
  }, []);

  return (
    <Crud
      resource="products"
      title="المنتجات"
      fields={[
        { name: "categoryId", label: "رقم الفئة", type: "number", required: true },
        { name: "name", label: "اسم المنتج", type: "text", required: true },
        { name: "image", label: "رابط الصورة", type: "text" },
        { name: "priceUsd", label: "السعر (USD)", type: "number", step: "0.0001", required: true },
        { name: "priceSyp", label: "السعر (SYP)", type: "number", step: "0.01" },
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
        // حقل المزود – اختيار من قائمة المزودين
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