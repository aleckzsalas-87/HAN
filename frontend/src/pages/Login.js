import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
import { HardHat, ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@crm.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Sesión iniciada");
      navigate("/");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F4F4F5]">
      {/* Left - branding */}
      <div className="hidden lg:flex flex-1 bg-zinc-950 text-white relative overflow-hidden border-r-2 border-zinc-950">
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1527335988388-b40ee248d80c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlfGVufDB8fHx8MTc4MTgyOTA4NHww&ixlib=rb-4.1.0&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(100%) contrast(1.2)',
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-3 stripes-bg" />
        <div className="absolute bottom-0 left-0 right-0 h-3 stripes-bg" />

        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FF4500] flex items-center justify-center border-2 border-white">
              <HardHat className="w-7 h-7" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-heading font-black text-2xl uppercase tracking-tighter">ConstruCRM</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-400">Command Center v1.0</div>
            </div>
          </div>

          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#FF4500] mb-4">// PLATAFORMA PROFESIONAL</div>
            <h1 className="font-heading text-5xl xl:text-6xl font-black uppercase tracking-tighter leading-[0.9]">
              Construye<br />
              <span className="text-[#FF4500]">tu negocio.</span><br />
              Gestiona<br />
              cada obra.
            </h1>
            <p className="mt-6 text-zinc-300 max-w-md">
              CRM integral para empresas constructoras. Clientes, obras, cotizaciones, insumos y requisiciones en un mismo lugar.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t-2 border-zinc-800 pt-6">
            <div>
              <div className="font-mono text-2xl font-bold text-[#FF4500]">01</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">Pipeline</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-[#FF4500]">02</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">Obras</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-[#FF4500]">03</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">Insumos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right - form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#FF4500] flex items-center justify-center border-2 border-zinc-950">
              <HardHat className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="font-heading font-black text-xl uppercase">ConstruCRM</div>
          </div>

          <div className="brutal-card p-8">
            <div className="label-mono mb-2">// AUTENTICACION</div>
            <h2 className="font-heading text-3xl font-black uppercase tracking-tighter mb-6">Inicia Sesión</h2>

            <form onSubmit={submit} className="space-y-4" data-testid="login-form">
              <div>
                <label className="label-mono block mb-1.5">Correo</label>
                <input
                  data-testid="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="brutal-input"
                  placeholder="tu@empresa.com"
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Contraseña</label>
                <input
                  data-testid="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="brutal-input"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div data-testid="login-error" className="border-2 border-[#D32F2F] bg-red-50 text-[#D32F2F] px-3 py-2 text-sm font-bold uppercase">
                  {error}
                </div>
              )}

              <button
                data-testid="login-submit"
                type="submit"
                disabled={loading}
                className="brutal-btn-primary w-full py-3 text-base"
              >
                {loading ? "Verificando..." : <>Entrar <ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>}
              </button>

              <div className="flex justify-between text-sm pt-2">
                <Link to="/forgot-password" data-testid="forgot-link" className="text-zinc-600 hover:text-[#FF4500] underline">¿Olvidaste tu contraseña?</Link>
                <Link to="/register" data-testid="register-link" className="font-bold text-[#FF4500] hover:underline">Crear empresa →</Link>
              </div>
            </form>

            <div className="mt-6 border-t-2 border-zinc-200 pt-4">
              <div className="label-mono mb-2 flex items-center gap-2"><Lock className="w-3 h-3" /> Cuentas de prueba</div>
              <div className="space-y-1 text-xs font-mono">
                <div><b>admin@crm.com</b> / admin123</div>
                <div><b>vendedor@crm.com</b> / vendedor123</div>
                <div><b>supervisor@crm.com</b> / supervisor123</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
