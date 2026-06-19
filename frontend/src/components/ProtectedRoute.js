import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F5]">
        <div className="brutal-card p-8 flex items-center gap-4">
          <div className="w-6 h-6 stripes-bg animate-stripes border-2 border-zinc-950" />
          <span className="font-mono text-sm font-bold uppercase">Cargando...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F5] p-4">
        <div className="brutal-card p-8 max-w-md text-center">
          <div className="text-4xl mb-2 font-mono">403</div>
          <h2 className="font-heading text-2xl font-black uppercase">Acceso denegado</h2>
          <p className="text-sm text-zinc-600 mt-2">No tienes permisos para ver esta sección.</p>
        </div>
      </div>
    );
  }
  return children;
}
