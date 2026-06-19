export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="border-b-2 border-zinc-950 bg-white px-8 py-6 flex items-center justify-between gap-4 flex-wrap sticky top-0 z-10">
      <div>
        <div className="label-mono mb-1">// {subtitle || "Modulo"}</div>
        <h1 className="font-heading text-3xl md:text-4xl font-black uppercase tracking-tighter text-zinc-950">{title}</h1>
      </div>
      {action}
    </div>
  );
}
