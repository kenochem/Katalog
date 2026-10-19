import { ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import type { Product } from '../../types';
import {
  attributesFor,
  coerceAttrValue,
  formatAttrValue,
  getAttributes,
  hasAttrValue,
  useAttributesVersion,
  validateAttrValue,
  type AttrValue,
} from '../../lib/attributes';

/** Atrybuty strukturalne produktu: podgląd (uzupełnione i brakujące) oraz edycja wg kategorii. */
export function ProductAttributesPanel({
  product,
  values,
  editing,
  onChange,
}: {
  product: Product;
  /** Bieżące wartości (w edycji z formularza, poza edycją z produktu). */
  values: Record<string, AttrValue>;
  editing: boolean;
  onChange: (key: string, value: AttrValue | undefined) => void;
}) {
  const version = useAttributesVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defs = useMemo(() => attributesFor(product, getAttributes()), [product, version]);
  if (defs.length === 0) return null;
  const filled = defs.filter((d) => hasAttrValue(values[d.key])).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-sm dark:bg-slate-950/30 dark:shadow-none">
      <header className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/70 px-4 py-2">
        <ListChecks className="h-4 w-4 text-slate-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Parametry produktu</h3>
        <span className="ml-auto text-[11px] tabular-nums text-slate-500">
          {filled} / {defs.length}
        </span>
      </header>
      <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {defs.map((d) => {
          const v = values[d.key];
          const err = validateAttrValue(d, v);
          return (
            <div key={d.key} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {d.label}
                {d.required && <span className="text-rose-400">*</span>}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-100">
                {editing ? (
                  <>
                    {d.type === 'select' ? (
                      <select value={String(v ?? '')} onChange={(e) => onChange(d.key, e.target.value || undefined)} className="input-field text-sm">
                        <option value="">—</option>
                        {d.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : d.type === 'bool' ? (
                      <select
                        value={v === undefined ? '' : String(v)}
                        onChange={(e) => onChange(d.key, e.target.value === '' ? undefined : e.target.value === 'true')}
                        className="input-field text-sm"
                      >
                        <option value="">—</option>
                        <option value="true">Tak</option>
                        <option value="false">Nie</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          value={v === undefined ? '' : String(v)}
                          inputMode={d.type === 'number' ? 'decimal' : undefined}
                          onChange={(e) => onChange(d.key, d.type === 'number' ? coerceAttrValue(d, e.target.value) ?? (e.target.value.trim() === '' ? undefined : (e.target.value as AttrValue)) : coerceAttrValue(d, e.target.value))}
                          className="input-field text-sm"
                        />
                        {d.unit && <span className="shrink-0 text-xs text-slate-400">{d.unit}</span>}
                      </div>
                    )}
                    {err && v !== undefined && <span className="mt-0.5 block text-[11px] text-amber-400">{err}</span>}
                  </>
                ) : hasAttrValue(v) ? (
                  <span className={err ? 'text-amber-300' : ''}>{formatAttrValue(d, v)}</span>
                ) : (
                  <span className={d.required ? 'text-rose-400' : 'text-slate-500'}>{d.required ? 'brak (wymagane)' : '—'}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
