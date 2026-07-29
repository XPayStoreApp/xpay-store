import Crud from "../components/Crud";
export default function Categories() {
  return (
    <Crud
      resource="categories"
      title="الأقسام"
      beforeSubmit={(data) => ({
        ...data,
        name: typeof data.name === "string" ? data.name.trim() : data.name,
        image: typeof data.image === "string" ? data.image.trim() : data.image,
      })}
      fields={[
        { name: "name", label: "الاسم", type: "text", required: true },
        { name: "image", label: "رابط الصورة", type: "image", required: true },
        { name: "order", label: "الترتيب", type: "number", default: 0 },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
