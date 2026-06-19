import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Plus, Edit, Trash2, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { sku: "", name: "", category: "general", unit: "und", stock: 0, min_stock: 0, unit_cost: 0, supplier_id: "" };

export default function Materials() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      const [m, s] = await Promise.all([api.get("/materials"), api.get("/suppliers")]);
      setItems(m.data); setSuppliers(s.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...emptyForm, ...m }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    const data = { ...form, stock: Number(form.stock), min_stock: Number(form.min_stock), unit_cost: Number(form.unit_cost) };
    try {
      if (editing) await api.put(`/materials/${editing.id}`, data);
      else await api.post("/materials", data);
      toast.success("Guardado"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (m) => {
    if (!window.confirm(`¿Eliminar ${m.name}?`)) return;
    try { await api.delete(`/materials/${m.id}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  const filtered = items.filter(i =>
    i.name?.toLowerCase().includes(q.toLowerCase()) ||
    i.sku?.toLowerCase().includes(q.toLowerCase()) ||
    i.category?.toLowerCase().includes(q.toLowerCase())
  );
  const lowStockCount = items.filter(i => i.stock <= i.min_stock).length;

  return (
    <div>
      <PageHeader title="Insumos (Materiales)" subtitle="Inventario"
        action={<button data-testid="new-material-btn" onClick={openNew} className="brutal-btn-primary"><Plus className="w-4 h-4" /> Nuevo Insumo</button>} />

      <div className="p-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="brutal-card p-5"><div className="kpi-label">Total Insumos</div><div className="kpi-value">{items.length}</div></div>
          <div className="brutal-card p-5"><div className="kpi-label">Valor Inventario</div><div className="kpi-value">${items.reduce((s, i) => s + (i.stock * i.unit_cost), 0).toLocaleString()}</div></div>
          <div className="brutal-card p-5 border-[#D32F2F]"><div className="kpi-label flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Bajo Stock</div><div className="kpi-value text-[#D32F2F]">{lowStockCount}</div></div>
        </div>

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar SKU, nombre o categoría..." className="brutal-input" />

        <div className="brutal-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-950 text-white">
              <tr>
                <th className="text-left px-4 py-3 label-mono text-white">SKU</th>
                <th className="text-left px-4 py-3 label-mono text-white">Nombre</th>
                <th className="text-left px-4 py-3 label-mono text-white">Categoría</th>
                <th className="text-right px-4 py-3 label-mono text-white">Stock</th>
                <th className="text-right px-4 py-3 label-mono text-white">Mínimo</th>
                <th className="text-right px-4 py-3 label-mono text-white">Costo</th>
                <th className="text-right px-4 py-3 label-mono text-white">Total</th>
                <th className="text-right px-4 py-3 label-mono text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-zinc-500"><Package className="w-10 h-10 mx-auto mb-2" /><div className="font-mono text-sm">Sin insumos</div></td></tr>}
              {filtered.map((m, i) => {
                const low = m.stock <= m.min_stock;
                return (
                  <tr key={m.id} className={`${i % 2 ? "bg-zinc-50" : "bg-white"} ${low ? "border-l-4 border-l-[#D32F2F]" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-bold">{m.sku}</td>
                    <td className="px-4 py-3 font-bold">{m.name}</td>
                    <td className="px-4 py-3 text-sm uppercase">{m.category}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={low ? "text-[#D32F2F] font-bold" : ""}>{m.stock} {m.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-500">{m.min_stock}</td>
                    <td className="px-4 py-3 text-right font-mono">${m.unit_cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">${(m.stock * m.unit_cost).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(m)} className="p-1 hover:bg-[#FF4500] hover:text-white border-2 border-transparent hover:border-zinc-950 mr-1"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => remove(m)} className="p-1 hover:bg-[#D32F2F] hover:text-white border-2 border-transparent hover:border-zinc-950"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar Insumo" : "Nuevo Insumo"}
        footer={<>
          <button onClick={() => setOpen(false)} className="brutal-btn-secondary">Cancelar</button>
          <button form="mat-form" type="submit" data-testid="save-material" className="brutal-btn-primary">{editing ? "Actualizar" : "Crear"}</button>
        </>}>
        <form id="mat-form" onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="SKU *"><input data-testid="form-sku" required value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="brutal-input" /></F>
          <F label="Nombre *"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="brutal-input" /></F>
          <F label="Categoría"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="brutal-input" placeholder="cemento, acero, electrico..." /></F>
          <F label="Unidad"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="brutal-input" placeholder="kg, m, und, ton" /></F>
          <F label="Stock"><input type="number" step="0.01" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="brutal-input" /></F>
          <F label="Stock mínimo"><input type="number" step="0.01" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className="brutal-input" /></F>
          <F label="Costo unitario"><input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} className="brutal-input" /></F>
          <F label="Proveedor">
            <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className="brutal-input">
              <option value="">— Ninguno —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </F>
        </form>
      </Modal>
    </div>
  );
}

function F({ label, children }) {
  return <div><label className="label-mono block mb-1.5">{label}</label>{children}</div>;
}
