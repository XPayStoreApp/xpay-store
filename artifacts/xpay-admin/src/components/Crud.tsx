import { useState, useEffect } from "react";
import { get, post, put, del } from "../lib/api";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";

export type FieldType = "text" | "number" | "textarea" | "boolean" | "select" | "image";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  hideInTable?: boolean;
  default?: any;
  step?: string;
  placeholder?: string;
}

export interface CrudConfig {
  resource: string;
  title: string;
  fields: FieldDef[];
  rowExtras?: (row: any) => React.ReactNode;
  beforeSubmit?: (data: any) => any;
}

export default function Crud({ resource, title, fields, rowExtras, beforeSubmit }: CrudConfig) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  // حالة التحديد المتعدد
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await get(`/${resource}`);
      setItems(Array.isArray(data) ? data : data.items || []);
      setSelectedIds(new Set()); // إعادة تعيين التحديد بعد التحميل
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [resource]);

  const handleSave = async (data: any) => {
    const payload = beforeSubmit ? beforeSubmit(data) : data;
    if (editing?.id) {
      await put(`/${resource}/${editing.id}`, payload);
    } else {
      await post(`/${resource}`, payload);
    }
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: any) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await del(`/${resource}/${id}`);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // تحديد/إلغاء تحديد صف واحد
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // تحديد الكل/إلغاء الكل
  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  // حذف جماعي
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} عنصر؟`)) return;
    setBulkDeleting(true);
    try {
      await post("/bulk-delete", { resource, ids: Array.from(selectedIds) });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const tableFields = fields.filter((f) => !f.hideInTable);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 size={16} /> حذف المحدد ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() =>
              setEditing(
                fields.reduce<Record<string, any>>((acc, f) => {
                  acc[f.name] = f.default ?? (f.type === "boolean" ? false : "");
                  return acc;
                }, {}),
              )
            }
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-700"
          >
            <Plus size={18} /> إضافة جديد
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-center px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-brand-600"
                  />
                </th>
                <th className="text-right px-4 py-3 font-semibold">#</th>
                {tableFields.map((f) => (
                  <th key={f.name} className="text-right px-4 py-3 font-semibold">
                    {f.label}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-semibold w-32">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableFields.length + 3} className="text-center py-8 text-slate-400">
                    جاري التحميل...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={tableFields.length + 3} className="text-center py-8 text-slate-400">
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="text-center px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="w-4 h-4 accent-brand-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.id}</td>
                    {tableFields.map((f) => (
                      <td key={f.name} className="px-4 py-3">
                        <CellValue field={f} value={row[f.name]} />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {rowExtras?.(row)}
                        <button
                          onClick={() => setEditing(row)}
                          className="p-1.5 text-brand-600 hover:bg-brand-50 rounded"
                          title="تعديل"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                          title="حذف"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <FormModal
          title={editing.id ? "تعديل" : "إضافة جديد"}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function CellValue({ field, value }: { field: FieldDef; value: any }) {
  if (value === null || value === undefined) return <span className="text-slate-300">—</span>;
  if (field.type === "boolean") {
    return value ? (
      <span className="text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-0.5 rounded">نعم</span>
    ) : (
      <span className="text-slate-500 text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded">لا</span>
    );
  }
  if (field.type === "image") {
    return value ? (
      <img src={value} alt="" className="w-10 h-10 rounded object-cover" />
    ) : (
      <span className="text-slate-300">—</span>
    );
  }
  if (field.type === "select" && field.options) {
    const opt = field.options.find((o) => o.value === String(value));
    return <span>{opt?.label || value}</span>;
  }
  if (field.type === "textarea") {
    return <span className="line-clamp-2 max-w-xs block">{String(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

export function FormModal({
  title, fields, initial, onClose, onSave,
}: {
  title: string;
  fields: FieldDef[];
  initial: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [data, setData] = useState<any>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await onSave(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {f.label} {f.required && <span className="text-rose-500">*</span>}
              </label>
              <FieldInput
                field={f}
                value={data[f.name]}
                onChange={(v) => setData({ ...data, [f.name]: v })}
              />
            </div>
          ))}
          {err && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{err}</div>}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? "جاري الحفظ..." : "حفظ"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FieldInput({
  field, value, onChange,
}: {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
}) {
  const cls = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm";
  if (field.type === "textarea") {
    return (
      <textarea
        className={cls}
        rows={3}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 accent-brand-600"
        />
        <span className="text-sm text-slate-600">مفعل</span>
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <select
        className={cls}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">— اختر —</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        step={field.step || "any"}
        className={cls}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  }
  return (
    <input
      type="text"
      className={cls}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      required={field.required}
    />
  );
}