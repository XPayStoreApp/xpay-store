import Crud from "../components/Crud";
export default function Categories() {
  return (
    <Crud
      resource="categories"
      title="الأقسام"
      fields={[
        { name: "name", label: "الاسم", type: "text", required: true },
        { name: "image", label: "رابط الصورة", type: "text", required: true },
        { name: "order", label: "الترتيب", type: "number", default: 0 },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
