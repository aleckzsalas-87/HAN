import { useEffect, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const STAGE_LABEL = { lead: "Lead", contactado: "Contactado", propuesta: "Propuesta", negociacion: "Negociación", ganado: "Ganado", perdido: "Perdido" };
const STATUS_LABEL = { planificacion: "Planificación", en_progreso: "En Progreso", pausada: "Pausada", completada: "Completada", cancelada: "Cancelada" };

export default function Reports() {
  const [stats, setStats] = useState(null);
  const [byStatus, setByStatus] = useState([]);
  const [byStage, setByStage] = useState([]);
  const [quotes, setQuotes] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, ps, ls, q] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/reports/projects-by-status"),
        api.get("/reports/leads-by-stage"),
        api.get("/quotes"),
      ]);
      setStats(s.data); setByStatus(ps.data); setByStage(ls.data); setQuotes(q.data);
    })();
  }, []);

  // Revenue by month from accepted quotes
  const revenueByMonth = (() => {
    const map = {};
    quotes.filter(q => q.status === "aceptada").forEach(q => {
      const k = q.created_at?.slice(0, 7);
      if (!k) return;
      map[k] = (map[k] || 0) + (q.total || 0);
    });
    return Object.entries(map).sort().map(([month, total]) => ({ month, total }));
  })();

  if (!stats) return <div className="p-4 sm:p-6 lg:p-8"><div className="brutal-card p-8 font-mono">Cargando...</div></div>;

  return (
    <div>
      <PageHeader title="Reportes & Analítica" subtitle="Inteligencia de Negocio" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Clientes" value={stats.clients_count} />
          <Card label="Obras Activas" value={stats.active_projects} accent="#FF4500" />
          <Card label="Cotizaciones Pendientes" value={stats.pending_quotes} accent="#FFB300" />
          <Card label="Ingresos" value={`$${(stats.total_revenue || 0).toLocaleString()}`} accent="#00C853" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Obras por Estado">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byStatus.map(d => ({ ...d, label: STATUS_LABEL[d.status] || d.status }))}>
                <CartesianGrid stroke="#09090B" strokeDasharray="2 2" />
                <XAxis dataKey="label" stroke="#09090B" tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
                <YAxis stroke="#09090B" tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
                <Tooltip contentStyle={{ border: '2px solid #09090B', borderRadius: 0, fontFamily: 'JetBrains Mono' }} />
                <Bar dataKey="count" fill="#FF4500" stroke="#09090B" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Pipeline de Leads">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byStage.map(s => ({ ...s, name: STAGE_LABEL[s.stage] || s.stage }))} dataKey="count" nameKey="name" outerRadius={100} stroke="#09090B" strokeWidth={2}>
                  {byStage.map((_, i) => (<Cell key={i} fill={["#FF4500", "#0033A0", "#FFB300", "#00C853", "#52525B", "#D32F2F"][i % 6]} />))}
                </Pie>
                <Tooltip contentStyle={{ border: '2px solid #09090B', borderRadius: 0, fontFamily: 'JetBrains Mono' }} />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Ingresos por Mes (Cotizaciones Aceptadas)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueByMonth}>
              <CartesianGrid stroke="#09090B" strokeDasharray="2 2" />
              <XAxis dataKey="month" stroke="#09090B" tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
              <YAxis stroke="#09090B" tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
              <Tooltip contentStyle={{ border: '2px solid #09090B', borderRadius: 0, fontFamily: 'JetBrains Mono' }} />
              <Line type="linear" dataKey="total" stroke="#FF4500" strokeWidth={3} dot={{ fill: '#09090B', stroke: '#09090B', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function Card({ label, value, accent = "#09090B" }) {
  return (
    <div className="brutal-card p-5">
      <div className="h-1 mb-3" style={{ background: accent }} />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="brutal-card p-6">
      <h3 className="font-heading text-xl font-bold uppercase tracking-tight mb-4">{title}</h3>
      {children}
    </div>
  );
}
