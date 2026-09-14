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
          className="rounded-full border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-700 transition-colors hover:border-navy-300 hover:bg-navy-50"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
