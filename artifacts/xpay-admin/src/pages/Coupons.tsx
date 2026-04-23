import Crud from "../components/Crud";
export default function Coupons() {
  return (
    <Crud
      resource="coupons"
      title="كوبونات الخصم"
      fields={[
        { name: "code", label: "الكود", type: "text", required: true },
        { name: "discountPct", label: "نسبة الخصم %", type: "number", required: true, step: "0.01" },
        { name: "maxUses", label: "أقصى عدد استخدامات", type: "number", default: 100 },
        { name: "usedCount", label: "تم استخدامه", type: "number", default: 0 },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
