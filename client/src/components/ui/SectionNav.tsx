/** In-page jump links to the sections of a long listing. */
export function SectionNav({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; label: string }>;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-full border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
