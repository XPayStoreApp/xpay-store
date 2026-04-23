import Crud from "../components/Crud";
export default function News() {
  return (
    <Crud
      resource="news"
      title="الأخبار"
      fields={[
        { name: "content", label: "المحتوى", type: "textarea", required: true },
        {
          name: "type",
          label: "النوع",
          type: "select",
          default: "general",
          options: [
            { value: "general", label: "عام" },
            { value: "offer", label: "عرض" },
            { value: "alert", label: "تنبيه" },
            { value: "new_service", label: "خدمة جديدة" },
          ],
        },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
