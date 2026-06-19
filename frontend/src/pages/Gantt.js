import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";

const STATUS_COLORS = {
  planificacion: "#FFB300", en_progreso: "#FF4500", pausada: "#52525B",
  completada: "#00C853", cancelada: "#D32F2F",
};

export default function Gantt() {
  const [projects, setProjects] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/projects");
      setProjects(data);
    })();
  }, []);

  // Compute global date range
  const { startMs, endMs, months, totalDays } = useMemo(() => {
    const dates = projects
      .flatMap(p => [p.start_date, p.end_date, ...(p.stages || []).flatMap(s => [s.start_date, s.end_date])])
      .filter(Boolean)
      .map(d => new Date(d).getTime())
      .filter(t => !isNaN(t));
    if (dates.length === 0) {
      const now = new Date();
      const s = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const e = new Date(now.getFullYear(), now.getMonth() + 4, 0).getTime();
      return { startMs: s, endMs: e, months: monthRange(s, e), totalDays: Math.ceil((e - s) / 86400000) };
    }
    const minD = Math.min(...dates);
    const maxD = Math.max(...dates);
    const ds = new Date(minD); ds.setDate(1);
    const de = new Date(maxD); de.setMonth(de.getMonth() + 1, 0);
    return {
      startMs: ds.getTime(), endMs: de.getTime(),
      months: monthRange(ds.getTime(), de.getTime()),
      totalDays: Math.ceil((de.getTime() - ds.getTime()) / 86400000),
    };
  }, [projects]);

  const totalMs = endMs - startMs || 1;
  const barFor = (start, end) => {
    if (!start || !end) return null;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e)) return null;
    const left = Math.max(0, ((s - startMs) / totalMs) * 100);
    const right = Math.min(100, ((e - startMs) / totalMs) * 100);
    return { left: `${left}%`, width: `${Math.max(1, right - left)}%` };
  };

  // Build rows: project + its stages
  const rows = projects.flatMap(p => {
    const arr = [{ kind: "project", project: p, key: p.id }];
    (p.stages || []).forEach((s, i) => arr.push({ kind: "stage", project: p, stage: s, key: `${p.id}-${s.id || i}` }));
    return arr;
  });

  return (
    <div>
      <PageHeader title="Gantt de Obras" subtitle="Cronograma" />
      <div className="p-8">
        <div className="brutal-card overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: "900px" }}>
              {/* Months header */}
              <div className="grid border-b-2 border-zinc-950 bg-zinc-950 text-white" style={{ gridTemplateColumns: "280px 1fr" }}>
                <div className="px-3 py-2 label-mono text-white border-r-2 border-zinc-700">Obra / Etapa</div>
                <div className="flex">
                  {months.map(m => (
                    <div key={m.label} className="flex-1 border-r border-zinc-700 px-2 py-2 label-mono text-white text-center" style={{ minWidth: `${(m.days / totalDays) * 100}%` }}>
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {rows.length === 0 && (
                <div className="p-10 text-center font-mono text-zinc-500">Sin obras o etapas con fechas</div>
              )}
              {rows.map(r => {
                const bar = r.kind === "project"
                  ? barFor(r.project.start_date, r.project.end_date)
                  : barFor(r.stage.start_date, r.stage.end_date);
                const isProject = r.kind === "project";
                return (
                  <div key={r.key} className="grid border-b-2 border-zinc-200 hover:bg-zinc-50" style={{ gridTemplateColumns: "280px 1fr" }} onMouseEnter={() => setHoveredId(r.key)} onMouseLeave={() => setHoveredId(null)}>
                    <div className="px-3 py-2 border-r-2 border-zinc-200">
                      {isProject ? (
                        <div className="font-bold text-sm flex items-center gap-2">
                          <div className="w-2 h-2" style={{ background: STATUS_COLORS[r.project.status] || "#52525B" }} />
                          {r.project.name}
                        </div>
                      ) : (
                        <div className="pl-4 text-xs text-zinc-600">↳ {r.stage.name}</div>
                      )}
                    </div>
                    <div className="relative h-10 bg-[length:40px_40px] bg-[repeating-linear-gradient(90deg,transparent,transparent_39px,#e4e4e7_39px,#e4e4e7_40px)]">
                      {bar && (
                        <div
                          className={`absolute top-2 bottom-2 border-2 border-zinc-950 ${isProject ? "shadow-brutal-sm" : ""}`}
                          style={{
                            ...bar,
                            background: isProject ? (STATUS_COLORS[r.project.status] || "#52525B") : (r.stage.color || "#0033A0"),
                          }}
                        >
                          <div className="h-full relative overflow-hidden">
                            {/* Progress fill */}
                            <div className="absolute inset-y-0 left-0 bg-zinc-950/30" style={{ width: `${isProject ? (r.project.progress || 0) : (r.stage.progress || 0)}%` }} />
                            <div className="absolute inset-0 flex items-center px-2 text-[10px] font-mono font-bold text-white truncate">
                              {isProject ? `${r.project.progress || 0}%` : `${r.stage.progress || 0}%`}
                            </div>
                          </div>
                        </div>
                      )}
                      {hoveredId === r.key && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mt-[-4px] bg-zinc-950 text-white px-2 py-1 text-[10px] font-mono whitespace-nowrap z-10 border-2 border-zinc-950">
                          {isProject
                            ? `${r.project.start_date || "?"} → ${r.project.end_date || "?"}`
                            : `${r.stage.start_date || "?"} → ${r.stage.end_date || "?"}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs font-mono text-zinc-500">
          // El Gantt muestra obras como barras principales y sus etapas debajo. Agrega etapas al editar una obra.
        </div>
      </div>
    </div>
  );
}

function monthRange(startMs, endMs) {
  const out = [];
  const d = new Date(startMs); d.setDate(1);
  while (d.getTime() <= endMs) {
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const start = Math.max(d.getTime(), startMs);
    const end = Math.min(monthEnd.getTime(), endMs);
    const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
    out.push({
      label: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }).toUpperCase(),
      days,
    });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}
