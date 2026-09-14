import { useId, type ReactNode } from 'react';

/** One settings area: its title and explanation beside the controls. */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-6 rounded-card border border-ink-200 bg-white p-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:p-8"
    >
      <div>
        <h2 id={titleId} className="font-display text-2xl font-bold uppercase text-ink-950">
          {title}
        </h2>
        <p className="mt-1 text-sm text-ink-600">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
