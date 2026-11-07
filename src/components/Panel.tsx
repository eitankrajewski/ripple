import clsx from "clsx";
import type { ReactNode } from "react";

export function Panel({ title, icon, right, className, children }: { title?: ReactNode; icon?: ReactNode; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={clsx("glass relative flex min-h-0 flex-col rounded-2xl", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
            {icon && <span className="text-slate-500">{icon}</span>}
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
    <span className={clsx("inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-indigo-200", className)}>
      <span className="size-1.5 rounded-full bg-accent" />
      Simulated projection
    </span>
  );
}
