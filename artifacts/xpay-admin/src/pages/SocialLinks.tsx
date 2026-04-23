import Crud from "../components/Crud";
export default function SocialLinks() {
  return (
    <Crud
      resource="social-links"
      title="الروابط الاجتماعية"
      fields={[
        {
          name: "platform",
          label: "المنصة",
          type: "select",
          required: true,
          options: [
            { value: "telegram", label: "تيليجرام" },
            { value: "whatsapp", label: "واتساب" },
            { value: "facebook", label: "فيسبوك" },
            { value: "instagram", label: "انستغرام" },
            { value: "youtube", label: "يوتيوب" },
            { value: "phone", label: "هاتف" },
          ],
        },
        { name: "label", label: "الاسم الظاهر", type: "text", required: true },
        { name: "url", label: "الرابط", type: "text", required: true },
        { name: "order", label: "الترتيب", type: "number", default: 0 },
      ]}
    />
  );
}
