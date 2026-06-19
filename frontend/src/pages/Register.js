import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { HardHat, ArrowRight, Building } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    company_name: "", admin_name: "", admin_email: "", admin_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/register-company", form);
      if (data.token) localStorage.setItem("crm_token", data.token);
      setUser(data);
      toast.success("¡Cuenta creada!");
      navigate("/");
    } catch (err) {
      setError(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F5] p-6">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-[#FF4500] flex items-center justify-center border-2 border-zinc-950">
            <HardHat className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-heading text-2xl font-black uppercase tracking-tighter">ConstruCRM</div>
            <div className="label-mono">// Crear cuenta empresarial</div>
          </div>
        </div>

        <div className="brutal-card p-8">
          <h2 className="font-heading text-3xl font-black uppercase tracking-tighter mb-2 flex items-center gap-3">
            <Building className="w-7 h-7 text-[#FF4500]" strokeWidth={2.5} />
            Registra tu empresa
          </h2>
          <p className="text-zinc-600 mb-6 text-sm">Crea una cuenta nueva. Tendrás un espacio aislado para gestionar tu constructora.</p>

          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="register-form">
            <div className="md:col-span-2">
              <label className="label-mono block mb-1.5">Nombre de la empresa *</label>
              <input data-testid="register-company-name" required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} className="brutal-input" placeholder="Constructora ACME SA" />
            </div>
            <div>
              <label className="label-mono block mb-1.5">Tu nombre *</label>
              <input data-testid="register-admin-name" required value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} className="brutal-input" />
            </div>
            <div>
              <label className="label-mono block mb-1.5">Email *</label>
              <input data-testid="register-admin-email" type="email" required value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} className="brutal-input" />
            </div>
            <div className="md:col-span-2">
              <label className="label-mono block mb-1.5">Contraseña *</label>
              <input data-testid="register-admin-password" type="password" required minLength={6} value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} className="brutal-input" placeholder="Mínimo 6 caracteres" />
            </div>

            {error && (
              <div data-testid="register-error" className="md:col-span-2 border-2 border-[#D32F2F] bg-red-50 text-[#D32F2F] px-3 py-2 text-sm font-bold uppercase">
                {error}
              </div>
            )}

            <button data-testid="register-submit" type="submit" disabled={loading} className="brutal-btn-primary md:col-span-2 py-3 text-base">
              {loading ? "Creando..." : <>Crear cuenta empresarial <ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>}
            </button>
          </form>

          <div className="mt-4 text-sm">
            ¿Ya tienes cuenta? <Link to="/login" className="font-bold text-[#FF4500] underline">Inicia sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
