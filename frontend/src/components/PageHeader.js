export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="border-b-2 border-zinc-950 bg-white px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 sticky top-[60px] lg:top-0 z-20">
      <div className="min-w-0">
        <div className="label-mono mb-1">// {subtitle || "Modulo"}</div>
        <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter text-zinc-950 truncate">{title}</h1>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
