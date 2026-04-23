import Crud from "../components/Crud";
export default function VipMemberships() {
  return (
    <Crud
      resource="vip"
      title="عضويات VIP"
      fields={[
        { name: "name", label: "الاسم", type: "text", required: true },
        { name: "requiredAmount", label: "المبلغ المطلوب ($)", type: "number", required: true, step: "0.01" },
        { name: "profitPct", label: "نسبة الخصم %", type: "number", required: true, step: "0.01" },
        { name: "badge", label: "لون الشارة", type: "text", placeholder: "#fbbf24" },
        { name: "hidden", label: "مخفي", type: "boolean", default: false },
      ]}
    />
  );
}
