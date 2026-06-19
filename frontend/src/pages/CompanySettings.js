import { useEffect, useRef, useState } from "react";
import api, { formatApiError, API_BASE } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Building, Upload, Save, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function CompanySettings() {
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", rfc: "" });
  const [logoVersion, setLogoVersion] = useState(0);
  const [hasLogo, setHasLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/company");
      setForm({
        name: data.name || "", address: data.address || "",
        phone: data.phone || "", email: data.email || "", rfc: data.rfc || "",
      });
      setHasLogo(!!data.logo_path);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.put("/company", form); toast.success("Datos actualizados"); }
    catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/company/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Logo actualizado");
      setHasLogo(true);
      setLogoVersion(v => v + 1);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const logoUrl = `${API_BASE}/company/logo?v=${logoVersion}`;
  const token = localStorage.getItem("crm_token");

  return (
    <div>
      <PageHeader title="Configuración de Empresa" subtitle="Identidad Corporativa" />
      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Logo */}
        <div className="brutal-card p-6">
          <div className="label-mono mb-2 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Logo</div>
          <h3 className="font-heading text-xl font-black uppercase tracking-tight mb-4">Identidad visual</h3>

          <div className="border-2 border-zinc-950 bg-zinc-50 aspect-square flex items-center justify-center mb-4 overflow-hidden">
            {hasLogo ? (
              <AuthImage src={logoUrl} token={token} className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-center p-6">
                <Building className="w-12 h-12 mx-auto text-zinc-400 mb-2" strokeWidth={2} />
                <div className="label-mono">Sin logo</div>
              </div>
            )}
          </div>

          <label className="brutal-btn-primary w-full cursor-pointer">
            <Upload className="w-4 h-4" />
            {uploading ? "Subiendo..." : "Cambiar logo"}
            <input
              ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => uploadLogo(e.target.files?.[0])}
              disabled={uploading}
              data-testid="upload-logo"
            />
          </label>
          <div className="text-[10px] font-mono text-zinc-500 mt-2 text-center">PNG/JPG, máx 2MB. Aparecerá en los reportes.</div>
        </div>

        {/* RIGHT: Company info */}
        <div className="brutal-card p-6 lg:col-span-2">
          <div className="label-mono mb-2">// Información Fiscal</div>
          <h3 className="font-heading text-xl font-black uppercase tracking-tight mb-4">Datos de la empresa</h3>

          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label-mono block mb-1.5">Nombre legal *</label>
              <input data-testid="company-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="brutal-input" />
            </div>
            <div>
              <label className="label-mono block mb-1.5">RFC / NIT / RUC</label>
              <input value={form.rfc} onChange={e => setForm({ ...form, rfc: e.target.value })} className="brutal-input" />
            </div>
            <div>
              <label className="label-mono block mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="brutal-input" />
            </div>
            <div>
              <label className="label-mono block mb-1.5">Teléfono</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="brutal-input" />
            </div>
            <div className="md:col-span-2">
              <label className="label-mono block mb-1.5">Dirección</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="brutal-input" />
            </div>
            <button data-testid="save-company" type="submit" disabled={saving} className="brutal-btn-primary md:col-span-2 py-3">
              <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function AuthImage({ src, token, className }) {
  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await fetch(src, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
        if (!resp.ok) return;
        const blob = await resp.blob();
        if (active) setBlobUrl(URL.createObjectURL(blob));
      } catch {}
    })();
    return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line
  }, [src]);
  return blobUrl ? <img src={blobUrl} alt="Logo" className={className} /> : null;
}
