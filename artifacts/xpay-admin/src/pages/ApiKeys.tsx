import Crud from "../components/Crud";
export default function ApiKeys() {
  return (
    <Crud
      resource="api-keys"
      title="مفاتيح API"
      fields={[
        { name: "name", label: "الاسم", type: "text", required: true },
        { name: "keyValue", label: "المفتاح", type: "text", required: true },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
