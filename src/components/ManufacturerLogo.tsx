import { getManufacturerEntry, useManufacturerRegistry } from '../lib/manufacturerRegistry';

function toUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** Logo producenta z jego profilu; klikalne, jeśli w profilu podano stronę WWW. Bez logo nic nie renderuje. */
export function ManufacturerLogo({ name, className = '' }: { name: string; className?: string }) {
  useManufacturerRegistry();
  const entry = name ? getManufacturerEntry(name) : undefined;
  if (!entry?.logoUrl) return null;
  const href = toUrl(entry.website);
  const img = <img src={entry.logoUrl} alt={name} loading="lazy" className="h-full w-full object-contain" />;
  const box = `flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-white p-1.5 ${className}`;
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${name} — otwórz stronę producenta`}
      className={`${box} transition hover:border-brand-400 hover:shadow`}
    >
      {img}
    </a>
  ) : (
    <span title={name} className={box}>
      {img}
    </span>
  );
}
