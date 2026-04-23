import Crud from "../components/Crud";
export default function Admins() {
  return (
    <Crud
      resource="admins"
      title="المشرفون"
      fields={[
        { name: "username", label: "اسم المستخدم", type: "text", required: true },
        { name: "fullName", label: "الاسم الكامل", type: "text", required: true },
        { name: "email", label: "البريد", type: "text" },
        { name: "password", label: "كلمة المرور (اتركها فارغة للإبقاء)", type: "text", hideInTable: true },
        {
          name: "role",
          label: "الدور",
          type: "select",
          default: "admin",
          options: [
            { value: "super_admin", label: "مدير عام" },
            { value: "admin", label: "مشرف" },
            { value: "support", label: "دعم فني" },
          ],
        },
        { name: "active", label: "مفعل", type: "boolean", default: true },
      ]}
    />
  );
}
