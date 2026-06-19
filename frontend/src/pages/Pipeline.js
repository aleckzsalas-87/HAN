import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const STAGES = [
  { v: "lead", label: "Lead", color: "#52525B" },
  { v: "contactado", label: "Contactado", color: "#0033A0" },
  { v: "propuesta", label: "Propuesta", color: "#FFB300" },
  { v: "negociacion", label: "Negociación", color: "#FF4500" },
  { v: "ganado", label: "Ganado", color: "#00C853" },
  { v: "perdido", label: "Perdido", color: "#D32F2F" },
];

export default function Pipeline() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [dragId, setDragId] = useState(null);
  const canEdit = ["admin", "vendedor"].includes(user.role);

  const load = async () => {
    try { const { data } = await api.get("/clients"); setItems(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const onDragStart = (id) => setDragId(id);
  const onDrop = async (stage) => {
    if (!dragId) return;
    const c = items.find(x => x.id === dragId);
    if (!c || c.stage === stage) { setDragId(null); return; }
    setItems(items.map(x => x.id === dragId ? { ...x, stage } : x));
    try {
      await api.put(`/clients/${dragId}`, { ...c, stage });
      toast.success(`Movido a ${STAGES.find(s => s.v === stage)?.label}`);
    } catch (e) {
      toast.error(formatApiError(e));
      load();
    }
    setDragId(null);
  };

  return (
    <div>
      <PageHeader title="Pipeline" subtitle="Vista Kanban" />
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {STAGES.map(s => {
            const stageItems = items.filter(i => i.stage === s.v);
            return (
              <div
                key={s.v}
                onDragOver={(e) => canEdit && e.preventDefault()}
                onDrop={() => canEdit && onDrop(s.v)}
                className="brutal-card flex flex-col min-h-[400px]"
                data-testid={`pipeline-column-${s.v}`}
              >
                <div className="px-3 py-3 border-b-2 border-zinc-950 flex items-center justify-between" style={{ background: s.color }}>
                  <div className="text-white">
                    <div className="text-[10px] font-mono uppercase tracking-widest opacity-80">{s.v}</div>
                    <div className="font-heading text-base font-black uppercase tracking-tight">{s.label}</div>
                  </div>
                  <div className="bg-white text-zinc-950 border-2 border-zinc-950 px-2 py-0.5 font-mono text-sm font-bold">{stageItems.length}</div>
                </div>
                <div className="p-2 flex-1 space-y-2 overflow-y-auto">
                  {stageItems.map(c => (
                    <div
                      key={c.id}
                      draggable={canEdit}
                      onDragStart={() => onDragStart(c.id)}
                      data-testid={`pipeline-card-${c.id}`}
                      className={`bg-white border-2 border-zinc-950 p-2.5 shadow-brutal-sm ${canEdit ? "cursor-grab active:cursor-grabbing hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none" : ""} transition-all`}
                    >
                      <div className="font-bold text-sm">{c.name}</div>
                      {c.company && <div className="text-xs text-zinc-600">{c.company}</div>}
                      {c.email && <div className="text-[10px] font-mono text-zinc-500 truncate">{c.email}</div>}
                    </div>
                  ))}
                  {stageItems.length === 0 && (
                    <div className="text-center text-xs font-mono text-zinc-400 py-6">— Sin clientes —</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {canEdit && <div className="mt-4 text-xs font-mono text-zinc-500">// Arrastra y suelta para cambiar de etapa</div>}
      </div>
    </div>
  );
}
