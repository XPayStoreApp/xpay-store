import Crud from "../components/Crud";
export default function Banners() {
  return (
    <Crud
      resource="banners"
      title="البانرات"
      fields={[
        { name: "title", label: "العنوان", type: "text", required: true },
        { name: "image", label: "رابط الصورة", type: "text", required: true },
        { name: "link", label: "الرابط (اختياري)", type: "text" },
        { name: "order", label: "الترتيب", type: "number", default: 0 },
      ]}
    />
  );
}
