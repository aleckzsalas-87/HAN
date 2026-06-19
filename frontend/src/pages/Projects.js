import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Plus, Edit, Trash2, Building2, MapPin, Layers, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import ProjectAttachments from "../components/ProjectAttachments";

const STATUSES = [
  { v: "planificacion", label: "Planificación", color: "#FFB300" },
  { v: "en_progreso", label: "En Progreso", color: "#FF4500" },
  { v: "pausada", label: "Pausada", color: "#52525B" },
  { v: "completada", label: "Completada", color: "#00C853" },
  { v: "cancelada", label: "Cancelada", color: "#D32F2F" },
];

const emptyForm = {
  name: "", client_id: "", client_name: "", address: "", status: "planificacion",
  progress: 0, start_date: "", end_date: "", budget: 0, supervisor_id: "", description: "",
  stages: [],
};

export default function Projects() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try {
      const [p, c] = await Promise.all([api.get("/projects"), api.get("/clients")]);
      setItems(p.data); setClients(c.data);
      try { const u = await api.get("/users"); setSupervisors(u.data.filter(x => x.role === "supervisor")); } catch {}
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...emptyForm, ...p }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      budget: Number(form.budget) || 0,
      progress: Number(form.progress) || 0,
      stages: (form.stages || []).map(s => ({ ...s, progress: Number(s.progress) || 0 })),
    };
    const client = clients.find(c => c.id === form.client_id);
    if (client) data.client_name = client.name;
    try {
      if (editing) await api.put(`/projects/${editing.id}`, data);
      else await api.post("/projects", data);
      toast.success(editing ? "Obra actualizada" : "Obra creada");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const addStage = () => {
    setForm(f => ({ ...f, stages: [...(f.stages || []), { id: `s-${Date.now()}`, name: "", start_date: "", end_date: "", progress: 0, color: "#0033A0" }] }));
  };
  const updateStage = (i, key, val) => {
    const next = [...(form.stages || [])];
    next[i] = { ...next[i], [key]: val };
    setForm({ ...form, stages: next });
  };
  const removeStage = (i) => setForm({ ...form, stages: form.stages.filter((_, j) => j !== i) });

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar obra ${p.name}?`)) return;
    try { await api.delete(`/projects/${p.id}`); toast.success("Eliminada"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const statusColor = (s) => STATUSES.find(x => x.v === s)?.color || "#52525B";
  const filtered = items.filter(i => filter === "all" || i.status === filter);

  return (
    <div>
      <PageHeader
        title="Obras"
        subtitle="Gestión de Proyectos"
        action={
          <button data-testid="new-project-btn" onClick={openNew} className="brutal-btn-primary">
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Nueva Obra
          </button>
        }
      />

      <div className="p-8 space-y-4">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilter("all")} className={`brutal-btn ${filter === "all" ? "bg-zinc-950 text-white" : "bg-white"}`}>Todas ({items.length})</button>
          {STATUSES.map(s => (
            <button key={s.v} onClick={() => setFilter(s.v)} className={`brutal-btn ${filter === s.v ? "text-white" : "bg-white"}`} style={filter === s.v ? { background: s.color } : {}}>
              {s.label} ({items.filter(i => i.status === s.v).length})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="brutal-card p-12 col-span-full text-center">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-zinc-400" strokeWidth={2} />
              <div className="font-mono text-zinc-500">Sin obras registradas</div>
            </div>
          )}
          {filtered.map(p => (
            <div key={p.id} data-testid={`project-card-${p.id}`} className="brutal-card overflow-hidden flex flex-col">
              <div className="h-2" style={{ background: statusColor(p.status) }} />
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-heading text-lg font-bold uppercase tracking-tight">{p.name}</h3>
                  <span className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-white" style={{ background: statusColor(p.status) }}>
                    {STATUSES.find(s => s.v === p.status)?.label || p.status}
                  </span>
                </div>
                <div className="text-sm text-zinc-600 mb-3">{p.client_name || "Sin cliente"}</div>
                {p.address && <div className="flex items-center gap-1 text-xs text-zinc-500 mb-3"><MapPin className="w-3 h-3" /> {p.address}</div>}

                <div className="mb-2">
                  <div className="flex justify-between label-mono mb-1">
                    <span>Progreso</span>
                    <span className="font-mono">{p.progress || 0}%</span>
                  </div>
                  <div className="h-3 border-2 border-zinc-950 bg-white">
                    <div className="h-full bg-[#FF4500]" style={{ width: `${p.progress || 0}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t-2 border-zinc-200">
                  <div>
                    <div className="label-mono">Presupuesto</div>
                    <div className="font-mono font-bold">${(p.budget || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="label-mono">Inicio</div>
                    <div className="font-mono text-sm">{p.start_date || "—"}</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button onClick={() => openEdit(p)} data-testid={`edit-project-${p.id}`} className="brutal-btn-secondary flex-1"><Edit className="w-3 h-3" /> Editar</button>
                  <button onClick={() => remove(p)} data-testid={`delete-project-${p.id}`} className="brutal-btn bg-white text-[#D32F2F] hover:bg-[#D32F2F] hover:text-white"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar Obra" : "Nueva Obra"} size="xl"
        footer={<>
          <button onClick={() => setOpen(false)} className="brutal-btn-secondary">Cancelar</button>
          <button form="project-form" type="submit" data-testid="save-project" className="brutal-btn-primary">{editing ? "Actualizar" : "Crear"}</button>
        </>}>
        <form id="project-form" onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Nombre *" full><input data-testid="form-project-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="brutal-input" /></F>
          <F label="Cliente">
            <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="brutal-input">
              <option value="">— Sin cliente —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </F>
          <F label="Estado">
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="brutal-input">
              {STATUSES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </F>
          <F label="Dirección" full><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="brutal-input" /></F>
          <F label="Fecha Inicio"><input type="date" value={form.start_date || ""} onChange={e => setForm({ ...form, start_date: e.target.value })} className="brutal-input" /></F>
          <F label="Fecha Fin"><input type="date" value={form.end_date || ""} onChange={e => setForm({ ...form, end_date: e.target.value })} className="brutal-input" /></F>
          <F label="Presupuesto ($)"><input type="number" step="0.01" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="brutal-input" /></F>
          <F label="Progreso (%)"><input type="number" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} className="brutal-input" /></F>
          <F label="Supervisor" full>
            <select value={form.supervisor_id} onChange={e => setForm({ ...form, supervisor_id: e.target.value })} className="brutal-input">
              <option value="">— Sin asignar —</option>
              {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </F>
          <F label="Descripción" full><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="brutal-input" /></F>

          <div className="md:col-span-2 border-2 border-zinc-950">
            <div className="bg-zinc-950 text-white px-3 py-2 flex justify-between items-center">
              <span className="label-mono text-white flex items-center gap-2"><Layers className="w-3 h-3" /> Etapas de la obra</span>
              <button type="button" onClick={addStage} className="text-xs font-bold uppercase hover:text-[#FF4500]">+ Agregar Etapa</button>
            </div>
            <div className="divide-y-2 divide-zinc-200">
              {(form.stages || []).length === 0 && <div className="p-3 text-center text-xs font-mono text-zinc-500">Sin etapas. Agrega etapas para visualizar en el Gantt.</div>}
              {(form.stages || []).map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 p-2">
                  <input placeholder="Nombre etapa" value={s.name} onChange={e => updateStage(i, "name", e.target.value)} className="brutal-input col-span-4" required />
                  <input type="date" value={s.start_date || ""} onChange={e => updateStage(i, "start_date", e.target.value)} className="brutal-input col-span-3" />
                  <input type="date" value={s.end_date || ""} onChange={e => updateStage(i, "end_date", e.target.value)} className="brutal-input col-span-3" />
                  <input type="number" min="0" max="100" value={s.progress} onChange={e => updateStage(i, "progress", e.target.value)} className="brutal-input col-span-1" placeholder="%" />
                  <button type="button" onClick={() => removeStage(i)} className="col-span-1 brutal-btn bg-white text-[#D32F2F] hover:bg-[#D32F2F] hover:text-white"><XIcon className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          {editing && (
            <div className="md:col-span-2">
              <ProjectAttachments projectId={editing.id} />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

function F({ label, children, full }) {
  return <div className={full ? "md:col-span-2" : ""}><label className="label-mono block mb-1.5">{label}</label>{children}</div>;
}
