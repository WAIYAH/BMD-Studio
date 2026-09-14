/** `90` → `1 hr 30 min`, `30` → `30 min`, `120` → `2 hrs`. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`);
  if (rest > 0 || hours === 0) parts.push(`${rest} min`);
  return parts.join(' ');
}

/** `60, 300` → `1 hr – 5 hrs`; collapses to one value when both ends match. */
export function formatDurationRange(minMinutes: number, maxMinutes: number): string {
  if (minMinutes === maxMinutes) return formatMinutes(minMinutes);
  return `${formatMinutes(minMinutes)} – ${formatMinutes(maxMinutes)}`;
}
