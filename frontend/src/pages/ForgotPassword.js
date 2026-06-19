import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { formatApiError } from "../lib/api";
import { Mail, KeyRound, ArrowRight, HardHat } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("Revisa tu correo");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally { setLoading(false); }
  };

  return (
    <Shell title="Recuperar contraseña" subtitle="// PASO 1">
      {sent ? (
        <div data-testid="forgot-sent" className="text-center space-y-3">
          <Mail className="w-12 h-12 mx-auto text-[#FF4500]" strokeWidth={2} />
          <p className="font-bold">Si el email existe, recibirás un enlace de recuperación.</p>
          <p className="text-sm text-zinc-600">Revisa la bandeja de entrada (y spam).</p>
          <Link to="/login" className="brutal-btn-primary inline-flex">Volver al login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-zinc-600">Ingresa tu email para recibir un enlace de recuperación.</p>
          <div>
            <label className="label-mono block mb-1.5">Email</label>
            <input data-testid="forgot-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="brutal-input" />
          </div>
          <button data-testid="forgot-submit" type="submit" disabled={loading} className="brutal-btn-primary w-full py-3">
            {loading ? "Enviando..." : <>Enviar enlace <ArrowRight className="w-4 h-4" /></>}
          </button>
          <div className="text-sm text-center">
            <Link to="/login" className="text-zinc-600 underline">Volver al login</Link>
          </div>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (pwd !== confirm) { toast.error("Las contraseñas no coinciden"); return; }
    if (pwd.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pwd });
      toast.success("Contraseña actualizada");
      navigate("/login");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally { setLoading(false); }
  };

  if (!token) {
    return (
      <Shell title="Token inválido" subtitle="// ERROR">
        <p className="text-center text-zinc-600">El enlace de recuperación no es válido.</p>
        <Link to="/login" className="brutal-btn-primary inline-flex w-full justify-center mt-4">Volver</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Nueva contraseña" subtitle="// PASO 2">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-mono block mb-1.5">Nueva contraseña</label>
          <input data-testid="reset-pwd" type="password" required minLength={6} value={pwd} onChange={e => setPwd(e.target.value)} className="brutal-input" />
        </div>
        <div>
          <label className="label-mono block mb-1.5">Confirmar</label>
          <input data-testid="reset-confirm" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="brutal-input" />
        </div>
        <button data-testid="reset-submit" type="submit" disabled={loading} className="brutal-btn-primary w-full py-3">
          {loading ? "Guardando..." : "Actualizar contraseña"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F5] p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#FF4500] flex items-center justify-center border-2 border-zinc-950">
            <HardHat className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="font-heading font-black text-xl uppercase">ConstruCRM</div>
        </div>
        <div className="brutal-card p-8">
          <div className="label-mono mb-2 flex items-center gap-1"><KeyRound className="w-3 h-3" /> {subtitle}</div>
          <h2 className="font-heading text-3xl font-black uppercase tracking-tighter mb-4">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
