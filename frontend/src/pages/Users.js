import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { v: "admin", label: "Admin", color: "#FF4500" },
  { v: "vendedor", label: "Vendedor", color: "#0033A0" },
  { v: "supervisor", label: "Supervisor", color: "#09090B" },
];

const emptyForm = { name: "", email: "", password: "", role: "vendedor" };

export default function Users() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try { const { data } = await api.get("/users"); setItems(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", form);
      toast.success("Usuario creado"); setOpen(false); setForm(emptyForm); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (u) => {
    if (u.id === user.id) { toast.error("No puedes eliminarte"); return; }
    if (!window.confirm(`¿Eliminar a ${u.name}?`)) return;
    try { await api.delete(`/users/${u.id}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div>
      <PageHeader title="Usuarios" subtitle="Gestión de Acceso"
        action={<button data-testid="new-user-btn" onClick={() => setOpen(true)} className="brutal-btn-primary"><Plus className="w-4 h-4" /> Nuevo Usuario</button>} />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="brutal-card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950 text-white">
              <tr>
                <th className="text-left px-4 py-3 label-mono text-white">Nombre</th>
                <th className="text-left px-4 py-3 label-mono text-white">Email</th>
                <th className="text-left px-4 py-3 label-mono text-white">Rol</th>
                <th className="text-left px-4 py-3 label-mono text-white">Creado</th>
                <th className="text-right px-4 py-3 label-mono text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-zinc-500"><UserCog className="w-10 h-10 mx-auto mb-2" /><div className="font-mono text-sm">Sin usuarios</div></td></tr>}
              {items.map((u, i) => {
                const role = ROLES.find(r => r.v === u.role);
                return (
                  <tr key={u.id} data-testid={`user-row-${u.id}`} className={i % 2 ? "bg-zinc-50" : "bg-white"}>
                    <td className="px-4 py-3 font-bold flex items-center gap-2">
                      <div className="w-8 h-8 bg-zinc-950 text-white flex items-center justify-center font-mono text-xs">{u.name?.[0]?.toUpperCase()}</div>
                      {u.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-white" style={{ background: role?.color || "#52525B" }}>
                        {role?.label || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{u.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => remove(u)} disabled={u.id === user.id} className="p-1 hover:bg-[#D32F2F] hover:text-white border-2 border-transparent hover:border-zinc-950 disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo Usuario"
        footer={<>
          <button onClick={() => setOpen(false)} className="brutal-btn-secondary">Cancelar</button>
          <button form="user-form" type="submit" data-testid="save-user" className="brutal-btn-primary">Crear</button>
        </>}>
        <form id="user-form" onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Nombre *" full><input data-testid="form-user-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="brutal-input" /></F>
          <F label="Email *"><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="brutal-input" /></F>
          <F label="Contraseña *"><input type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="brutal-input" /></F>
          <F label="Rol" full>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="brutal-input">
              {ROLES.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </F>
        </form>
      </Modal>
    </div>
  );
}

function F({ label, children, full }) {
  return <div className={full ? "md:col-span-2" : ""}><label className="label-mono block mb-1.5">{label}</label>{children}</div>;
}
