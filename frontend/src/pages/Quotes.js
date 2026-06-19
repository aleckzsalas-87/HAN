import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Plus, Trash2, FileText, Eye, FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportQuotePDF } from "../lib/pdf";

const STATUSES = [
  { v: "borrador", label: "Borrador", color: "#52525B" },
  { v: "enviada", label: "Enviada", color: "#0033A0" },
  { v: "aceptada", label: "Aceptada", color: "#00C853" },
  { v: "rechazada", label: "Rechazada", color: "#D32F2F" },
];

const emptyForm = {
  client_id: "", client_name: "", project_id: "",
  items: [{ description: "", quantity: 1, unit_price: 0, unit: "und" }],
  tax_rate: 16, status: "borrador", notes: "",
};

export default function Quotes() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [company, setCompany] = useState({});

  const load = async () => {
    try {
      const [q, c, p, comp] = await Promise.all([api.get("/quotes"), api.get("/clients"), api.get("/projects"), api.get("/company").catch(() => ({ data: {} }))]);
      setItems(q.data); setClients(c.data); setProjects(p.data); setCompany(comp.data || {});
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setOpen(true); };

  const updateItem = (i, key, val) => {
    const next = [...form.items];
    next[i] = { ...next[i], [key]: key === "description" || key === "unit" ? val : Number(val) };
    setForm({ ...form, items: next });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, unit_price: 0, unit: "und" }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) });

  const subtotal = form.items.reduce((s, it) => s + (it.quantity || 0) * (it.unit_price || 0), 0);
  const tax = subtotal * (form.tax_rate / 100);
  const total = subtotal + tax;

  const save = async (e) => {
    e.preventDefault();
    const client = clients.find(c => c.id === form.client_id);
    const data = { ...form, client_name: client?.name || "", tax_rate: Number(form.tax_rate) };
    try {
      await api.post("/quotes", data);
      toast.success("Cotización creada");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const setStatus = async (q, status) => {
    try {
      await api.put(`/quotes/${q.id}`, {
        client_id: q.client_id, client_name: q.client_name, project_id: q.project_id,
        items: q.items, tax_rate: q.tax_rate, status, notes: q.notes,
      });
      toast.success("Estado actualizado"); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (q) => {
    if (!window.confirm(`¿Eliminar ${q.number}?`)) return;
    try { await api.delete(`/quotes/${q.id}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  const statusColor = (s) => STATUSES.find(x => x.v === s)?.color || "#52525B";

  return (
    <div>
      <PageHeader title="Cotizaciones" subtitle="Presupuestos"
        action={<button data-testid="new-quote-btn" onClick={openNew} className="brutal-btn-primary"><Plus className="w-4 h-4" /> Nueva Cotización</button>}
      />

      <div className="p-8">
        <div className="brutal-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-950 text-white">
              <tr>
                <th className="text-left px-4 py-3 label-mono text-white">#</th>
                <th className="text-left px-4 py-3 label-mono text-white">Cliente</th>
                <th className="text-left px-4 py-3 label-mono text-white">Items</th>
                <th className="text-right px-4 py-3 label-mono text-white">Total</th>
                <th className="text-left px-4 py-3 label-mono text-white">Estado</th>
                <th className="text-right px-4 py-3 label-mono text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-zinc-500"><FileText className="w-10 h-10 mx-auto mb-2" /><div className="font-mono text-sm">Sin cotizaciones</div></td></tr>}
              {items.map((q, i) => (
                <tr key={q.id} className={i % 2 ? "bg-zinc-50" : "bg-white"}>
                  <td className="px-4 py-3 font-mono font-bold">{q.number}</td>
                  <td className="px-4 py-3">{q.client_name || "—"}</td>
                  <td className="px-4 py-3 font-mono text-sm">{q.items?.length || 0}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">${(q.total || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <select value={q.status} onChange={e => setStatus(q, e.target.value)} className="border-2 border-zinc-950 px-2 py-1 text-[10px] font-mono font-bold uppercase text-white focus:outline-none" style={{ background: statusColor(q.status) }}>
                      {STATUSES.map(s => <option key={s.v} value={s.v} style={{ background: 'white', color: 'black' }}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setView(q)} className="p-1 hover:bg-[#0033A0] hover:text-white border-2 border-transparent hover:border-zinc-950 mr-1" title="Ver"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => exportQuotePDF(q, company)} data-testid={`pdf-quote-${q.id}`} className="p-1 hover:bg-[#FF4500] hover:text-white border-2 border-transparent hover:border-zinc-950 mr-1" title="Exportar PDF"><FileDown className="w-4 h-4" /></button>
                    <button onClick={() => remove(q)} className="p-1 hover:bg-[#D32F2F] hover:text-white border-2 border-transparent hover:border-zinc-950" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva Cotización" size="xl"
        footer={<>
          <button onClick={() => setOpen(false)} className="brutal-btn-secondary">Cancelar</button>
          <button form="quote-form" type="submit" data-testid="save-quote" className="brutal-btn-primary">Crear</button>
        </>}>
        <form id="quote-form" onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="label-mono block mb-1.5">Cliente *</label>
              <select required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="brutal-input">
                <option value="">— Selecciona —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label-mono block mb-1.5">Obra (opcional)</label>
              <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="brutal-input">
                <option value="">—</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label-mono block mb-1.5">IVA (%)</label>
              <input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} className="brutal-input" />
            </div>
          </div>

          <div className="border-2 border-zinc-950">
            <div className="bg-zinc-950 text-white px-3 py-2 flex justify-between items-center">
              <span className="label-mono text-white">Items</span>
              <button type="button" onClick={addItem} className="text-xs font-bold uppercase hover:text-[#FF4500]">+ Agregar</button>
            </div>
            <div className="divide-y-2 divide-zinc-200">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 p-2">
                  <input placeholder="Descripción" value={it.description} onChange={e => updateItem(i, "description", e.target.value)} className="brutal-input col-span-5" required />
                  <input type="number" step="0.01" value={it.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="brutal-input col-span-2" placeholder="Cant" />
                  <input value={it.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="brutal-input col-span-1" placeholder="und" />
                  <input type="number" step="0.01" value={it.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} className="brutal-input col-span-2" placeholder="Precio" />
                  <div className="col-span-1 flex items-center justify-end font-mono text-xs font-bold">${(it.quantity * it.unit_price).toFixed(2)}</div>
                  <button type="button" onClick={() => removeItem(i)} className="col-span-1 brutal-btn bg-white text-[#D32F2F] hover:bg-[#D32F2F] hover:text-white"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <textarea placeholder="Notas..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="brutal-input" rows={3} />
            <div className="brutal-card p-4 space-y-1 font-mono">
              <div className="flex justify-between"><span className="label-mono">Subtotal</span><span className="font-bold">${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="label-mono">IVA ({form.tax_rate}%)</span><span className="font-bold">${tax.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg pt-2 border-t-2 border-zinc-950"><span className="label-mono">Total</span><span className="font-black text-[#FF4500]">${total.toFixed(2)}</span></div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Cotización ${view.number}` : ""} size="lg"
        footer={view && <>
          <button onClick={() => exportQuotePDF(view, company)} data-testid="view-pdf-btn" className="brutal-btn-primary"><FileDown className="w-4 h-4" /> Descargar PDF</button>
        </>}>
        {view && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="label-mono">Cliente</div><div className="font-bold">{view.client_name || "—"}</div></div>
              <div><div className="label-mono">Estado</div><div className="font-bold uppercase">{view.status}</div></div>
            </div>
            <table className="w-full border-2 border-zinc-950">
              <thead className="bg-zinc-950 text-white"><tr>
                <th className="text-left p-2 label-mono text-white">Descripción</th>
                <th className="text-right p-2 label-mono text-white">Cant</th>
                <th className="text-right p-2 label-mono text-white">Precio</th>
                <th className="text-right p-2 label-mono text-white">Total</th>
              </tr></thead>
              <tbody>
                {view.items?.map((it, i) => (
                  <tr key={i} className={i % 2 ? "bg-zinc-50" : "bg-white"}>
                    <td className="p-2">{it.description}</td>
                    <td className="p-2 text-right font-mono">{it.quantity} {it.unit}</td>
                    <td className="p-2 text-right font-mono">${it.unit_price.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono font-bold">${(it.quantity * it.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-mono space-y-1">
              <div>Subtotal: <b>${view.subtotal?.toFixed(2)}</b></div>
              <div>IVA: <b>${view.tax?.toFixed(2)}</b></div>
              <div className="text-xl text-[#FF4500] font-black">Total: ${view.total?.toFixed(2)}</div>
            </div>
            {view.notes && <div><div className="label-mono">Notas</div><div className="text-sm">{view.notes}</div></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
