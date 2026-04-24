import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Crud from "../components/Crud";
import { api } from "../lib/api";

export default function Providers() {
  const [syncing, setSyncing] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSync = async (id: number) => {
    setSyncing(id);
    setSyncMessage(null);
    try {
      const res = await api<any>(`/providers/${id}/sync`, { method: "POST" });
      setSyncMessage(`✅ ${res.message || "تمت المزامنة بنجاح"}`);
    } catch (err: any) {
      setSyncMessage(`❌ ${err.message}`);
    } finally {
      setSyncing(null);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  return (
    <div>
      {syncMessage && (
        <div className="mb-4 p-3 bg-gray-100 rounded-lg text-sm">{syncMessage}</div>
      )}
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
          { name: "providerType", label: "نوع المزود", type: "text", default: "custom" },
        ]}
        rowExtras={(row: any) => (
          <div className="flex gap-1">
        
	<button
  onClick={() => {
    if (!row.id) {
      alert("معرف المزود غير متوفر. انتظر تحميل الصفحة.");
      return;
    }
    navigate(`/providers/${row.id}/products`);
  }}
  className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-xs"
>
  	منتجات
	</button>

          </div>
        )}
      />
    </div>
  );
}