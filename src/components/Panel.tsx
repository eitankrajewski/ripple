import clsx from "clsx";
import type { ReactNode } from "react";

export function Panel({ title, icon, right, className, children }: { title?: ReactNode; icon?: ReactNode; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={clsx("glass relative flex min-h-0 flex-col rounded-[28px]", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
          <h2 className="flex items-center gap-2 text-[17px] font-extrabold text-ink">
            {icon && <span className="text-mute">{icon}</span>}
            {title}
          </h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function SimBadge({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-mute", className)}>
      <span className="size-1.5 rounded-full bg-grape" />
      Simulated
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx("inline-flex rounded-full bg-black/[0.05] p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition-all",
            value === o.value ? "bg-white text-ink shadow-sm" : "text-mute hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
