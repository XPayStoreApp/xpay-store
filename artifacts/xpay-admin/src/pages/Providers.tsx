import Crud from "../components/Crud";
export default function Providers() {
  return (
    <Crud
      resource="providers"
      title="المزودون"
      fields={[
        { name: "name", label: "الاسم", type: "text", required: true },
        { name: "apiUrl", label: "رابط API", type: "text" },
        { name: "apiKey", label: "مفتاح API", type: "text", hideInTable: true },
        { name: "notes", label: "ملاحظات", type: "textarea", hideInTable: true },
        { name: "priority", label: "الأولوية", type: "number", default: 0 },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
