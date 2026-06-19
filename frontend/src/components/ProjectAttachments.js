import { useEffect, useRef, useState } from "react";
import api, { formatApiError } from "../lib/api";
import { Paperclip, Upload, Download, Trash2, FileText, Image as ImageIcon, File } from "lucide-react";
import { toast } from "sonner";

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProjectAttachments({ projectId }) {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const load = async () => {
    try { const { data } = await api.get(`/projects/${projectId}/attachments`); setItems(data); }
    catch (e) { console.error(e); }
  };
  useEffect(() => { if (projectId) load(); }, [projectId]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/projects/${projectId}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Archivo subido");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const download = async (att) => {
    try {
      const token = localStorage.getItem("crm_token");
      const resp = await fetch(`${API_BASE}/attachments/${att.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Error");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = att.original_filename || "archivo";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast.error("No se pudo descargar"); }
  };

  const remove = async (att) => {
    if (!window.confirm(`Eliminar ${att.original_filename}?`)) return;
    try { await api.delete(`/attachments/${att.id}`); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const iconFor = (ct = "") => {
    if (ct.startsWith("image/")) return ImageIcon;
    if (ct.includes("pdf")) return FileText;
    return File;
  };

  const formatSize = (b = 0) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border-2 border-zinc-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="label-mono flex items-center gap-2"><Paperclip className="w-3 h-3" /> Archivos adjuntos ({items.length})</div>
        <label className="brutal-btn-secondary cursor-pointer">
          <Upload className="w-4 h-4" />
          {uploading ? "Subiendo..." : "Subir archivo"}
          <input
            ref={inputRef} type="file" className="hidden"
            onChange={(e) => upload(e.target.files?.[0])} disabled={uploading}
            data-testid="upload-attachment"
          />
        </label>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-6 text-zinc-500 font-mono text-xs">— Sin archivos adjuntos —</div>
      ) : (
        <div className="divide-y-2 divide-zinc-200">
          {items.map(att => {
            const Icon = iconFor(att.content_type);
            return (
              <div key={att.id} className="flex items-center gap-3 py-2" data-testid={`attachment-${att.id}`}>
                <Icon className="w-5 h-5 text-zinc-600" strokeWidth={2.5} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{att.original_filename}</div>
                  <div className="text-[10px] font-mono text-zinc-500">{formatSize(att.size)} · {att.uploaded_by_name}</div>
                </div>
                <button onClick={() => download(att)} className="p-1 hover:bg-[#0033A0] hover:text-white border-2 border-transparent hover:border-zinc-950"><Download className="w-4 h-4" /></button>
                <button onClick={() => remove(att)} className="p-1 hover:bg-[#D32F2F] hover:text-white border-2 border-transparent hover:border-zinc-950"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
