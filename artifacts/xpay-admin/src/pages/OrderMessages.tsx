import Crud from "../components/Crud";
export default function OrderMessages() {
  return (
    <Crud
      resource="order-messages"
      title="رسائل الطلبات"
      fields={[
        {
          name: "event",
          label: "الحدث",
          type: "select",
          required: true,
          options: [
            { value: "order_created", label: "إنشاء طلب" },
            { value: "order_accepted", label: "قبول طلب" },
            { value: "order_rejected", label: "رفض طلب" },
            { value: "deposit_created", label: "إنشاء إيداع" },
            { value: "deposit_approved", label: "قبول إيداع" },
            { value: "deposit_rejected", label: "رفض إيداع" },
          ],
        },
        { name: "title", label: "العنوان", type: "text", required: true },
        { name: "body", label: "النص", type: "textarea", required: true },
      ]}
    />
  );
}
