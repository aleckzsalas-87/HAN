import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Plus, Trash2, ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

const STATUSES = [
  { v: "pendiente", label: "Pendiente", color: "#FFB300" },
  { v: "aprobada", label: "Aprobada", color: "#0033A0" },
  { v: "rechazada", label: "Rechazada", color: "#D32F2F" },
  { v: "entregada", label: "Entregada", color: "#00C853" },
];

const emptyForm = { project_id: "", project_name: "", items: [], needed_by: "", notes: "" };

export default function Requisitions() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const [r, p, m] = await Promise.all([api.get("/requisitions"), api.get("/projects"), api.get("/materials")]);
      setItems(r.data); setProjects(p.data); setMaterials(m.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setOpen(true); };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { material_id: "", material_name: "", quantity: 1, unit: "und", notes: "" }] }));
  const updateItem = (i, key, val) => {
    const next = [...form.items];
    next[i] = { ...next[i], [key]: key === "quantity" ? Number(val) : val };
    if (key === "material_id") {
      const m = materials.find(x => x.id === val);
      if (m) { next[i].material_name = m.name; next[i].unit = m.unit; }
    }
    setForm({ ...form, items: next });
  };
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) });

  const save = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) { toast.error("Agrega al menos un material"); return; }
    const proj = projects.find(p => p.id === form.project_id);
    const data = { ...form, project_name: proj?.name || "" };
    try {
      await api.post("/requisitions", data);
      toast.success("Requisición creada"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const setStatus = async (r, status) => {
    try {
      await api.put(`/requisitions/${r.id}/status`, null, { params: { status } });
      toast.success("Estado actualizado"); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (r) => {
    if (!window.confirm(`¿Eliminar ${r.number}?`)) return;
    try { await api.delete(`/requisitions/${r.id}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  const statusColor = (s) => STATUSES.find(x => x.v === s)?.color || "#52525B";
  const canApprove = ["admin", "supervisor"].includes(user.role);

  return (
    <div>
      <PageHeader title="Requisiciones de Insumos" subtitle="Solicitudes de Material"
        action={<button data-testid="new-req-btn" onClick={openNew} className="brutal-btn-primary"><Plus className="w-4 h-4" /> Nueva Requisición</button>} />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="brutal-card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950 text-white">
              <tr>
                <th className="text-left px-4 py-3 label-mono text-white">#</th>
                <th className="text-left px-4 py-3 label-mono text-white">Obra</th>
                <th className="text-left px-4 py-3 label-mono text-white">Solicitante</th>
                <th className="text-right px-4 py-3 label-mono text-white">Items</th>
                <th className="text-left px-4 py-3 label-mono text-white">Necesario</th>
                <th className="text-left px-4 py-3 label-mono text-white">Estado</th>
                <th className="text-right px-4 py-3 label-mono text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-zinc-500"><ClipboardList className="w-10 h-10 mx-auto mb-2" /><div className="font-mono text-sm">Sin requisiciones</div></td></tr>}
              {items.map((r, i) => (
                <tr key={r.id} className={i % 2 ? "bg-zinc-50" : "bg-white"}>
                  <td className="px-4 py-3 font-mono font-bold cursor-pointer hover:text-[#FF4500]" onClick={() => setView(r)}>{r.number}</td>
                  <td className="px-4 py-3">{r.project_name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{r.requested_by_name || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.items?.length || 0}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.needed_by || "—"}</td>
                  <td className="px-4 py-3">
                    {canApprove ? (
                      <select value={r.status} onChange={e => setStatus(r, e.target.value)} className="border-2 border-zinc-950 px-2 py-1 text-[10px] font-mono font-bold uppercase text-white focus:outline-none" style={{ background: statusColor(r.status) }}>
                        {STATUSES.map(s => <option key={s.v} value={s.v} style={{ background: 'white', color: 'black' }}>{s.label}</option>)}
                      </select>
                    ) : (
                      <span className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-white" style={{ background: statusColor(r.status) }}>
                        {STATUSES.find(s => s.v === r.status)?.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.role === "admin" && (
                      <button onClick={() => remove(r)} className="p-1 hover:bg-[#D32F2F] hover:text-white border-2 border-transparent hover:border-zinc-950"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva Requisición" size="lg"
        footer={<>
          <button onClick={() => setOpen(false)} className="brutal-btn-secondary">Cancelar</button>
          <button form="req-form" type="submit" data-testid="save-req" className="brutal-btn-primary">Crear</button>
        </>}>
        <form id="req-form" onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label-mono block mb-1.5">Obra *</label>
              <select required value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="brutal-input">
                <option value="">— Selecciona —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label-mono block mb-1.5">Fecha necesaria</label>
              <input type="date" value={form.needed_by} onChange={e => setForm({ ...form, needed_by: e.target.value })} className="brutal-input" />
            </div>
          </div>

          <div className="border-2 border-zinc-950">
            <div className="bg-zinc-950 text-white px-3 py-2 flex justify-between items-center">
              <span className="label-mono text-white">Materiales</span>
              <button type="button" onClick={addItem} className="text-xs font-bold uppercase hover:text-[#FF4500]">+ Agregar</button>
            </div>
            <div className="divide-y-2 divide-zinc-200">
              {form.items.length === 0 && <div className="p-3 text-center text-sm text-zinc-500 font-mono">Sin items. Haz click en "+ Agregar"</div>}
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 p-2">
                  <select value={it.material_id} onChange={e => updateItem(i, "material_id", e.target.value)} className="brutal-input col-span-6" required>
                    <option value="">— Material —</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                  </select>
                  <input type="number" step="0.01" min="0.01" value={it.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="brutal-input col-span-2" placeholder="Cant" />
                  <input value={it.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="brutal-input col-span-2" placeholder="und" />
                  <input value={it.notes} onChange={e => updateItem(i, "notes", e.target.value)} className="brutal-input col-span-1" placeholder="Nota" />
                  <button type="button" onClick={() => removeItem(i)} className="col-span-1 brutal-btn bg-white text-[#D32F2F] hover:bg-[#D32F2F] hover:text-white"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          <textarea placeholder="Notas / Observaciones..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="brutal-input" rows={2} />
        </form>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Requisición ${view.number}` : ""} size="lg">
        {view && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="label-mono">Obra</div><div className="font-bold">{view.project_name || "—"}</div></div>
              <div><div className="label-mono">Solicitante</div><div className="font-bold">{view.requested_by_name}</div></div>
              <div><div className="label-mono">Necesario</div><div className="font-mono">{view.needed_by || "—"}</div></div>
              <div><div className="label-mono">Estado</div><div className="font-bold uppercase">{view.status}</div></div>
            </div>
            <table className="w-full border-2 border-zinc-950">
              <thead className="bg-zinc-950 text-white"><tr>
                <th className="text-left p-2 label-mono text-white">Material</th>
                <th className="text-right p-2 label-mono text-white">Cant</th>
                <th className="text-left p-2 label-mono text-white">Notas</th>
              </tr></thead>
              <tbody>
                {view.items?.map((it, i) => (
                  <tr key={i} className={i % 2 ? "bg-zinc-50" : "bg-white"}>
                    <td className="p-2">{it.material_name}</td>
                    <td className="p-2 text-right font-mono">{it.quantity} {it.unit}</td>
                    <td className="p-2 text-sm">{it.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {view.notes && <div><div className="label-mono">Observaciones</div><div className="text-sm">{view.notes}</div></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
