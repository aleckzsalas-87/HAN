import { useEffect, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import {
  Users, Building2, FileText, ClipboardList, Package, TrendingUp,
  AlertTriangle, CheckCircle2, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = {
  planificacion: "#FFB300",
  en_progreso: "#FF4500",
  pausada: "#52525B",
  completada: "#00C853",
  cancelada: "#D32F2F",
};

const STAGE_LABEL = {
  lead: "Lead", contactado: "Contactado", propuesta: "Propuesta",
  negociacion: "Negociación", ganado: "Ganado", perdido: "Perdido",
};

function KPI({ label, value, icon: Icon, accent = "#FF4500", testid }) {
  return (
    <div data-testid={testid} className="brutal-card p-6 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="kpi-label">{label}</div>
        <div className="w-9 h-9 flex items-center justify-center border-2 border-zinc-950" style={{ background: accent }}>
          <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [byStatus, setByStatus] = useState([]);
  const [byStage, setByStage] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, ps, ls, pr] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/reports/projects-by-status"),
          api.get("/reports/leads-by-stage"),
          api.get("/projects"),
        ]);
        setStats(s.data);
        setByStatus(ps.data);
        setByStage(ls.data);
        setProjects(pr.data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  if (!stats) {
    return (
      <div className="p-8">
        <div className="brutal-card p-8 flex items-center gap-4">
          <div className="w-6 h-6 stripes-bg animate-stripes border-2 border-zinc-950" />
          <span className="font-mono text-sm font-bold uppercase">Cargando datos...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Hola, ${user.name?.split(" ")[0]}`}
        subtitle="Panel General"
        action={
          <div className="flex items-center gap-2">
            <div className="px-3 py-2 border-2 border-zinc-950 bg-white font-mono text-xs uppercase tracking-widest">
              {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI testid="kpi-clients" label="Clientes Totales" value={stats.clients_count} icon={Users} />
          <KPI testid="kpi-projects" label="Obras Activas" value={stats.active_projects} icon={Building2} accent="#0033A0" />
          <KPI testid="kpi-quotes" label="Cotizaciones Pendientes" value={stats.pending_quotes} icon={FileText} accent="#FFB300" />
          <KPI testid="kpi-requisitions" label="Requisiciones Pendientes" value={stats.pending_requisitions} icon={ClipboardList} accent="#09090B" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI testid="kpi-revenue" label="Ingresos (Cotizaciones Ganadas)" value={`$${(stats.total_revenue || 0).toLocaleString()}`} icon={TrendingUp} accent="#00C853" />
          <KPI testid="kpi-won" label="Ventas Ganadas" value={stats.won_count} icon={CheckCircle2} accent="#0033A0" />
          <KPI testid="kpi-leads" label="Leads en Pipeline" value={stats.leads_count} icon={ArrowUpRight} />
          <KPI testid="kpi-low-stock" label="Insumos Bajo Stock" value={stats.low_stock_count} icon={AlertTriangle} accent="#D32F2F" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="brutal-card p-6">
            <div className="label-mono mb-1">// Distribución</div>
            <h3 className="font-heading text-xl font-bold uppercase tracking-tight mb-4">Obras por Estado</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byStatus.map(d => ({ ...d, label: d.status.replace("_", " ") }))}>
                <CartesianGrid stroke="#09090B" strokeDasharray="2 2" />
                <XAxis dataKey="label" stroke="#09090B" tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, textTransform: 'uppercase' }} />
                <YAxis stroke="#09090B" tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
                <Tooltip contentStyle={{ border: '2px solid #09090B', borderRadius: 0, fontFamily: 'JetBrains Mono' }} />
                <Bar dataKey="count" fill="#FF4500" stroke="#09090B" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="brutal-card p-6">
            <div className="label-mono mb-1">// Pipeline</div>
            <h3 className="font-heading text-xl font-bold uppercase tracking-tight mb-4">Leads por Etapa</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={byStage.map(s => ({ ...s, name: STAGE_LABEL[s.stage] || s.stage }))}
                  dataKey="count"
                  nameKey="name"
                  outerRadius={90}
                  stroke="#09090B"
                  strokeWidth={2}
                >
                  {byStage.map((s, i) => (
                    <Cell key={i} fill={["#FF4500", "#0033A0", "#FFB300", "#00C853", "#52525B", "#D32F2F"][i % 6]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ border: '2px solid #09090B', borderRadius: 0, fontFamily: 'JetBrains Mono' }} />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent projects */}
        <div className="brutal-card">
          <div className="px-6 py-4 border-b-2 border-zinc-950 flex items-center justify-between">
            <div>
              <div className="label-mono">// Operaciones</div>
              <h3 className="font-heading text-xl font-bold uppercase tracking-tight">Obras Recientes</h3>
            </div>
            <Package className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-950 text-white">
                <tr>
                  <th className="text-left px-6 py-3 label-mono text-white">Obra</th>
                  <th className="text-left px-6 py-3 label-mono text-white">Cliente</th>
                  <th className="text-left px-6 py-3 label-mono text-white">Estado</th>
                  <th className="text-left px-6 py-3 label-mono text-white">Progreso</th>
                  <th className="text-right px-6 py-3 label-mono text-white">Presupuesto</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-zinc-500 font-mono text-sm">Sin obras registradas</td></tr>
                )}
                {projects.slice(0, 6).map((p, i) => (
                  <tr key={p.id} className={i % 2 ? "bg-zinc-50" : "bg-white"}>
                    <td className="px-6 py-3 font-bold">{p.name}</td>
                    <td className="px-6 py-3 text-sm">{p.client_name || "—"}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-white" style={{ background: STATUS_COLORS[p.status] || "#52525B" }}>
                        {p.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 border-2 border-zinc-950 bg-white">
                          <div className="h-full bg-[#FF4500]" style={{ width: `${p.progress || 0}%` }} />
                        </div>
                        <span className="font-mono text-xs font-bold w-10 text-right">{p.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold">${(p.budget || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
