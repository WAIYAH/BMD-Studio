import { cn } from '@/lib/cn';

/** A pill-shaped set of mutually exclusive filter buttons. */
export function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-full border border-ink-200 bg-white p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
              active ? 'bg-ink-950 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-950',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
