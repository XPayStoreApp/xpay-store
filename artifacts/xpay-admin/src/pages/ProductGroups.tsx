import { useEffect, useState } from "react";
import Crud from "../components/Crud";
import { get } from "../lib/api";

export default function ProductGroups() {
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    get<any[]>("/categories")
      .then((rows) => {
        setCategories(rows.map((cat) => ({ value: String(cat.id), label: `${cat.id} - ${cat.name}` })));
      })
      .catch((error) => console.error("Failed to load categories for product groups:", error));
  }, []);

  return (
    <Crud
      resource="product-groups"
      title="مجموعات المنتجات"
      beforeSubmit={(data) => ({
        ...data,
        name: typeof data.name === "string" ? data.name.trim() : data.name,
        image: typeof data.image === "string" ? data.image.trim() : data.image,
      })}
      fields={[
        {
          name: "categoryId",
          label: "القسم الرئيسي",
          type: "select",
          required: true,
          options: categories.length ? categories : [{ value: "", label: "لا توجد أقسام" }],
        },
        { name: "name", label: "اسم المجموعة", type: "text", required: true },
        { name: "image", label: "صورة المجموعة", type: "image", required: true },
        { name: "order", label: "الترتيب", type: "number", default: 0 },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
