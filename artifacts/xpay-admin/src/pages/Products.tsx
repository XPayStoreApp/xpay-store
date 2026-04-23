import { useEffect, useState } from "react";
import Crud, { FieldDef } from "../components/Crud";
import { get } from "../lib/api";

export default function Products() {
  const [cats, setCats] = useState<any[]>([]);
  useEffect(() => {
    get("/categories").then(setCats).catch(() => {});
  }, []);
  const fields: FieldDef[] = [
    { name: "name", label: "اسم المنتج", type: "text", required: true },
    {
      name: "categoryId",
      label: "القسم",
      type: "select",
      required: true,
      options: cats.map((c) => ({ value: String(c.id), label: c.name })),
    },
    { name: "image", label: "رابط الصورة", type: "text", required: true },
    { name: "priceUsd", label: "السعر ($)", type: "number", required: true, step: "0.01" },
    { name: "priceSyp", label: "السعر (ل.س)", type: "number", required: true, step: "1" },
    { name: "basePriceUsd", label: "سعر التكلفة ($)", type: "number", step: "0.01", hideInTable: true },
    {
      name: "productType",
      label: "النوع",
      type: "select",
      default: "package",
      options: [
        { value: "package", label: "باقة" },
        { value: "amount", label: "كمية" },
      ],
    },
    { name: "minQty", label: "أقل كمية", type: "number", hideInTable: true },
    { name: "maxQty", label: "أعلى كمية", type: "number", hideInTable: true },
    { name: "description", label: "الوصف", type: "textarea", hideInTable: true },
    { name: "available", label: "متوفر", type: "boolean", default: true },
    { name: "featured", label: "مميز", type: "boolean", default: false },
  ];
  return (
    <Crud
      resource="products"
      title="المنتجات"
      fields={fields}
      beforeSubmit={(d) => ({ ...d, categoryId: Number(d.categoryId) })}
    />
  );
}
