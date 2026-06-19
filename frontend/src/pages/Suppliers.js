import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Plus, Edit, Trash2, Truck, Star } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { name: "", type: "proveedor", contact: "", email: "", phone: "", specialty: "", rating: 0 };

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try { const { data } = await api.get("/suppliers"); setItems(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...emptyForm, ...s }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    const data = { ...form, rating: Number(form.rating) };
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, data);
      else await api.post("/suppliers", data);
      toast.success("Guardado"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (s) => {
    if (!window.confirm(`¿Eliminar ${s.name}?`)) return;
    try { await api.delete(`/suppliers/${s.id}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  const filtered = items.filter(i => filter === "all" || i.type === filter);

  return (
    <div>
      <PageHeader title="Proveedores & Contratistas" subtitle="Directorio"
        action={<button data-testid="new-supplier-btn" onClick={openNew} className="brutal-btn-primary"><Plus className="w-4 h-4" /> Nuevo</button>} />

      <div className="p-8 space-y-4">
        <div className="flex gap-1">
          <button onClick={() => setFilter("all")} className={`brutal-btn ${filter === "all" ? "bg-zinc-950 text-white" : "bg-white"}`}>Todos</button>
          <button onClick={() => setFilter("proveedor")} className={`brutal-btn ${filter === "proveedor" ? "bg-[#FF4500] text-white" : "bg-white"}`}>Proveedores</button>
          <button onClick={() => setFilter("contratista")} className={`brutal-btn ${filter === "contratista" ? "bg-[#0033A0] text-white" : "bg-white"}`}>Contratistas</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="brutal-card p-12 col-span-full text-center">
              <Truck className="w-12 h-12 mx-auto mb-3 text-zinc-400" />
              <div className="font-mono text-zinc-500">Sin registros</div>
            </div>
          )}
          {filtered.map(s => (
            <div key={s.id} className="brutal-card p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-heading text-lg font-bold uppercase tracking-tight">{s.name}</h3>
                <span className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-white" style={{ background: s.type === "proveedor" ? "#FF4500" : "#0033A0" }}>{s.type}</span>
              </div>
              <div className="text-sm text-zinc-600 mb-2">{s.specialty || "Sin especialidad"}</div>
              <div className="space-y-1 text-sm font-mono">
                {s.contact && <div>👤 {s.contact}</div>}
                {s.email && <div>✉ {s.email}</div>}
                {s.phone && <div>☎ {s.phone}</div>}
              </div>
              <div className="flex items-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} className={`w-4 h-4 ${n <= s.rating ? "fill-[#FFB300] text-[#FFB300]" : "text-zinc-300"}`} strokeWidth={2.5} />
                ))}
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t-2 border-zinc-200">
                <button onClick={() => openEdit(s)} className="brutal-btn-secondary flex-1"><Edit className="w-3 h-3" /> Editar</button>
                <button onClick={() => remove(s)} className="brutal-btn bg-white text-[#D32F2F] hover:bg-[#D32F2F] hover:text-white"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar" : "Nuevo proveedor/contratista"}
        footer={<>
          <button onClick={() => setOpen(false)} className="brutal-btn-secondary">Cancelar</button>
          <button form="sup-form" type="submit" data-testid="save-supplier" className="brutal-btn-primary">{editing ? "Actualizar" : "Crear"}</button>
        </>}>
        <form id="sup-form" onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Nombre *"><input data-testid="form-supplier-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="brutal-input" /></F>
          <F label="Tipo">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="brutal-input">
              <option value="proveedor">Proveedor</option>
              <option value="contratista">Contratista</option>
            </select>
          </F>
          <F label="Contacto"><input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="brutal-input" /></F>
          <F label="Especialidad"><input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className="brutal-input" /></F>
          <F label="Email"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="brutal-input" /></F>
          <F label="Teléfono"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="brutal-input" /></F>
          <F label="Calificación (0-5)"><input type="number" min="0" max="5" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} className="brutal-input" /></F>
        </form>
      </Modal>
    </div>
  );
}

function F({ label, children }) {
  return <div><label className="label-mono block mb-1.5">{label}</label>{children}</div>;
}
