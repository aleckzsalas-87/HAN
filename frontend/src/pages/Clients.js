import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Plus, Edit, Trash2, Search, Users } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { v: "lead", label: "Lead", color: "#52525B" },
  { v: "contactado", label: "Contactado", color: "#0033A0" },
  { v: "propuesta", label: "Propuesta", color: "#FFB300" },
  { v: "negociacion", label: "Negociación", color: "#FF4500" },
  { v: "ganado", label: "Ganado", color: "#00C853" },
  { v: "perdido", label: "Perdido", color: "#D32F2F" },
];

const emptyForm = { name: "", company: "", email: "", phone: "", address: "", stage: "lead", notes: "" };

export default function Clients() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [filterStage, setFilterStage] = useState("all");

  const load = async () => {
    try { const { data } = await api.get("/clients"); setItems(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...emptyForm, ...c }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/clients/${editing.id}`, form);
      else await api.post("/clients", form);
      toast.success(editing ? "Cliente actualizado" : "Cliente creado");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar a ${c.name}?`)) return;
    try { await api.delete(`/clients/${c.id}`); toast.success("Eliminado"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const filtered = items.filter(i =>
    (filterStage === "all" || i.stage === filterStage) &&
    (i.name?.toLowerCase().includes(q.toLowerCase()) || i.company?.toLowerCase().includes(q.toLowerCase()) || i.email?.toLowerCase().includes(q.toLowerCase()))
  );

  const stageColor = (s) => STAGES.find(x => x.v === s)?.color || "#52525B";

  return (
    <div>
      <PageHeader
        title="Clientes & Leads"
        subtitle="Pipeline Comercial"
        action={
          <button data-testid="new-client-btn" onClick={openNew} className="brutal-btn-primary">
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Nuevo Cliente
          </button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" strokeWidth={2.5} />
            <input
              data-testid="search-clients"
              value={q} onChange={(e) => setQ(e.target.value)}
              className="brutal-input pl-10" placeholder="Buscar por nombre, empresa, email..."
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterStage("all")} className={`brutal-btn ${filterStage === "all" ? "bg-zinc-950 text-white" : "bg-white"}`}>Todos</button>
            {STAGES.map(s => (
              <button key={s.v} data-testid={`filter-${s.v}`} onClick={() => setFilterStage(s.v)} className={`brutal-btn ${filterStage === s.v ? "text-white" : "bg-white"}`} style={filterStage === s.v ? { background: s.color } : {}}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pipeline summary */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {STAGES.map(s => (
            <div key={s.v} className="brutal-card p-3">
              <div className="h-2 mb-2" style={{ background: s.color }} />
              <div className="label-mono">{s.label}</div>
              <div className="font-mono text-2xl font-bold">{items.filter(i => i.stage === s.v).length}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="brutal-card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950 text-white">
              <tr>
                <th className="text-left px-4 py-3 label-mono text-white">Nombre</th>
                <th className="text-left px-4 py-3 label-mono text-white">Empresa</th>
                <th className="text-left px-4 py-3 label-mono text-white">Contacto</th>
                <th className="text-left px-4 py-3 label-mono text-white">Etapa</th>
                <th className="text-right px-4 py-3 label-mono text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-zinc-500">
                  <Users className="w-10 h-10 mx-auto mb-2" strokeWidth={2} />
                  <div className="font-mono text-sm">Sin clientes</div>
                </td></tr>
              )}
              {filtered.map((c, i) => (
                <tr key={c.id} data-testid={`client-row-${c.id}`} className={i % 2 ? "bg-zinc-50" : "bg-white"}>
                  <td className="px-4 py-3 font-bold">{c.name}</td>
                  <td className="px-4 py-3 text-sm">{c.company || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{c.email || "—"}</div>
                    <div className="text-xs text-zinc-500 font-mono">{c.phone || ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-white" style={{ background: stageColor(c.stage) }}>
                      {STAGES.find(s => s.v === c.stage)?.label || c.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} data-testid={`edit-client-${c.id}`} className="p-1 hover:bg-[#FF4500] hover:text-white border-2 border-transparent hover:border-zinc-950 mr-1"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => remove(c)} data-testid={`delete-client-${c.id}`} className="p-1 hover:bg-[#D32F2F] hover:text-white border-2 border-transparent hover:border-zinc-950"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar Cliente" : "Nuevo Cliente"} size="lg"
        footer={<>
          <button onClick={() => setOpen(false)} className="brutal-btn-secondary">Cancelar</button>
          <button form="client-form" type="submit" data-testid="save-client" className="brutal-btn-primary">{editing ? "Actualizar" : "Crear"}</button>
        </>}>
        <form id="client-form" onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre *"><input data-testid="form-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="brutal-input" /></Field>
          <Field label="Empresa"><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="brutal-input" /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="brutal-input" /></Field>
          <Field label="Teléfono"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="brutal-input" /></Field>
          <Field label="Dirección" full><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="brutal-input" /></Field>
          <Field label="Etapa">
            <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className="brutal-input">
              {STAGES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Notas" full><textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="brutal-input" /></Field>
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="label-mono block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
