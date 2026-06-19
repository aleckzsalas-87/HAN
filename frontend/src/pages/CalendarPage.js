import { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { v: "visita", label: "Visita", color: "#FF4500" },
  { v: "reunion", label: "Reunión", color: "#0033A0" },
  { v: "entrega", label: "Entrega", color: "#00C853" },
  { v: "inspeccion", label: "Inspección", color: "#FFB300" },
  { v: "otro", label: "Otro", color: "#52525B" },
];

const emptyForm = { title: "", description: "", date: "", type: "reunion", project_id: "", client_id: "" };

export default function CalendarPage() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [cursor, setCursor] = useState(new Date());

  const load = async () => {
    try {
      const [e, p, c] = await Promise.all([api.get("/events"), api.get("/projects"), api.get("/clients")]);
      setItems(e.data); setProjects(p.data); setClients(c.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const firstWeekday = (monthStart.getDay() + 6) % 7; // Mon=0

  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= monthEnd.getDate(); d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return arr;
  }, [cursor, firstWeekday, monthEnd]);

  const eventsByDay = useMemo(() => {
    const map = {};
    items.forEach(e => {
      const k = e.date?.slice(0, 10);
      if (!k) return;
      (map[k] = map[k] || []).push(e);
    });
    return map;
  }, [items]);

  const openNew = (date) => {
    setForm({ ...emptyForm, date: date ? date.toISOString().slice(0, 10) + "T09:00" : "" });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try { await api.post("/events", form); toast.success("Evento creado"); setOpen(false); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (ev) => {
    if (!window.confirm(`Eliminar "${ev.title}"?`)) return;
    try { await api.delete(`/events/${ev.id}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  const typeColor = (t) => TYPES.find(x => x.v === t)?.color || "#52525B";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="Calendario" subtitle="Agenda & Visitas"
        action={<button data-testid="new-event-btn" onClick={() => openNew(new Date())} className="brutal-btn-primary"><Plus className="w-4 h-4" /> Nuevo Evento</button>} />

      <div className="p-8 space-y-4">
        <div className="brutal-card">
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 text-white">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="hover:text-[#FF4500]"><ChevronLeft /></button>
            <h2 className="font-heading text-2xl font-black uppercase tracking-tighter">
              {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </h2>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="hover:text-[#FF4500]"><ChevronRight /></button>
          </div>

          <div className="grid grid-cols-7 border-b-2 border-zinc-950">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
              <div key={d} className="label-mono text-center py-2 border-r-2 last:border-r-0 border-zinc-200">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const k = d?.toISOString().slice(0, 10);
              const dayEvents = (k && eventsByDay[k]) || [];
              const isToday = k === today;
              return (
                <div key={i} className={`min-h-[110px] border-r-2 border-b-2 border-zinc-200 last:border-r-0 p-1.5 ${d ? "cursor-pointer hover:bg-zinc-50" : "bg-zinc-50/50"} ${isToday ? "bg-orange-50" : ""}`} onClick={() => d && openNew(d)}>
                  {d && (
                    <>
                      <div className={`font-mono text-xs font-bold mb-1 ${isToday ? "text-[#FF4500]" : ""}`}>
                        {d.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => (
                          <div key={ev.id} className="text-[10px] font-bold text-white px-1 py-0.5 truncate" style={{ background: typeColor(ev.type) }} title={ev.title}>
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div className="text-[10px] font-mono">+{dayEvents.length - 3}</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="brutal-card p-5">
          <h3 className="font-heading text-lg font-bold uppercase mb-3">Próximos Eventos</h3>
          <div className="divide-y-2 divide-zinc-200">
            {items.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8).map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2">
                <div className="w-1 h-10" style={{ background: typeColor(e.type) }} />
                <div className="flex-1">
                  <div className="font-bold">{e.title}</div>
                  <div className="text-xs font-mono text-zinc-500">{new Date(e.date).toLocaleString("es-ES")}</div>
                </div>
                <span className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-white" style={{ background: typeColor(e.type) }}>{e.type}</span>
                <button onClick={() => remove(e)} className="p-1 hover:bg-[#D32F2F] hover:text-white border-2 border-transparent hover:border-zinc-950"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {items.length === 0 && <div className="text-zinc-500 font-mono text-sm py-4">Sin eventos próximos</div>}
          </div>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo Evento"
        footer={<>
          <button onClick={() => setOpen(false)} className="brutal-btn-secondary">Cancelar</button>
          <button form="ev-form" type="submit" data-testid="save-event" className="brutal-btn-primary">Crear</button>
        </>}>
        <form id="ev-form" onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Título *" full><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="brutal-input" /></F>
          <F label="Fecha & Hora *"><input required type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="brutal-input" /></F>
          <F label="Tipo">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="brutal-input">
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </F>
          <F label="Obra">
            <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="brutal-input">
              <option value="">—</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </F>
          <F label="Cliente">
            <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="brutal-input">
              <option value="">—</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </F>
          <F label="Descripción" full><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="brutal-input" /></F>
        </form>
      </Modal>
    </div>
  );
}

function F({ label, children, full }) {
  return <div className={full ? "md:col-span-2" : ""}><label className="label-mono block mb-1.5">{label}</label>{children}</div>;
}
