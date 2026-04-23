import Crud from "../components/Crud";
export default function PaymentMethods() {
  return (
    <Crud
      resource="payment-methods"
      title="طرق الدفع"
      fields={[
        {
          name: "code",
          label: "الكود",
          type: "select",
          required: true,
          options: [
            { value: "sham_cash", label: "شام كاش" },
            { value: "binance_pay", label: "Binance Pay" },
            { value: "syriatel_cash", label: "سيرياتيل كاش" },
            { value: "mtn_cash", label: "MTN كاش" },
            { value: "usdt_auto", label: "USDT تلقائي" },
          ],
        },
        { name: "name", label: "الاسم", type: "text", required: true },
        { name: "subtitle", label: "العنوان الفرعي", type: "text", required: true },
        { name: "instructions", label: "التعليمات", type: "textarea", hideInTable: true },
        { name: "walletAddress", label: "عنوان المحفظة", type: "text", hideInTable: true },
        { name: "qrImage", label: "صورة QR", type: "text", hideInTable: true },
        { name: "minAmount", label: "أقل مبلغ", type: "number", default: 1, step: "0.01" },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
