import { useEffect, useState } from "react";
import Crud, { FieldDef } from "../components/Crud";
import { get } from "../lib/api";

export default function AutoCodes() {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    get("/products").then(setProducts).catch(() => {});
  }, []);
  const fields: FieldDef[] = [
    {
      name: "productId",
      label: "المنتج",
      type: "select",
      required: true,
      options: products.map((p) => ({ value: String(p.id), label: p.name })),
    },
    { name: "code", label: "الكود", type: "text", required: true },
    { name: "note", label: "ملاحظة", type: "text" },
    { name: "used", label: "مستخدم", type: "boolean", default: false },
  ];
  return (
    <Crud
      resource="auto-codes"
      title="الأكواد التلقائية"
      fields={fields}
      beforeSubmit={(d) => ({ ...d, productId: Number(d.productId) })}
    />
  );
}
