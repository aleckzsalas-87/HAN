import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Building2, FileText, Truck, Package,
  ClipboardList, CalendarDays, BarChart3, UserCog, LogOut, HardHat,
  Kanban, GanttChartSquare,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/pipeline", label: "Pipeline", icon: Kanban, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/proyectos", label: "Obras", icon: Building2, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/gantt", label: "Gantt", icon: GanttChartSquare, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/cotizaciones", label: "Cotizaciones", icon: FileText, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/proveedores", label: "Proveedores", icon: Truck, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/insumos", label: "Insumos", icon: Package, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/requisiciones", label: "Requisiciones", icon: ClipboardList, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/calendario", label: "Calendario", icon: CalendarDays, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/reportes", label: "Reportes", icon: BarChart3, roles: ["admin", "vendedor", "supervisor"] },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, roles: ["admin"] },
];

const ROLE_BADGE = {
  admin: { label: "ADMIN", color: "bg-[#FF4500] text-white" },
  vendedor: { label: "VENDEDOR", color: "bg-[#0033A0] text-white" },
  supervisor: { label: "SUPERVISOR", color: "bg-zinc-950 text-white" },
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const visibleNav = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-[#F4F4F5] flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-zinc-950 text-white border-r-2 border-zinc-950 flex flex-col sticky top-0 h-screen" data-testid="sidebar">
        <div className="p-5 border-b-2 border-zinc-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FF4500] flex items-center justify-center border-2 border-white">
            <HardHat className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-heading font-black text-lg leading-none uppercase tracking-tight">ConstruCRM</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mt-1 font-mono">Command Center</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={`sidebar-nav-${n.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all border-l-4 ${
                  isActive
                    ? "bg-[#FF4500] text-white border-white"
                    : "text-zinc-300 border-transparent hover:bg-zinc-900 hover:text-white hover:border-[#FF4500]"
                }`
              }
            >
              <n.icon className="w-4 h-4" strokeWidth={2.5} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t-2 border-zinc-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white text-zinc-950 flex items-center justify-center font-mono font-bold text-sm border-2 border-white">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{user.name}</div>
              <div className={`inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold mt-0.5 ${ROLE_BADGE[user.role]?.color || "bg-zinc-700"}`}>
                {ROLE_BADGE[user.role]?.label || user.role}
              </div>
            </div>
          </div>
          <button
            data-testid="logout-button"
            onClick={handleLogout}
            className="w-full brutal-btn bg-white text-zinc-950 hover:bg-[#FF4500] hover:text-white"
          >
            <LogOut className="w-4 h-4" strokeWidth={2.5} /> Salir
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
