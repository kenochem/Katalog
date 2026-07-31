import { useMemo, useState } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import type { Product } from '../types';

interface EanHygieneViewProps {
  products: Product[];
  onOpenProduct: (p: Product) => void;
  onClose?: () => void;
}

type IssueKind = 'missing' | 'format' | 'checksum' | 'duplicate';

interface EanIssue {
  product: Product;
  kind: IssueKind;
  detail: string;
}

function digitsOnly(ean: string): string {
  return ean.replace(/\D/g, '');
}

/** Suma kontrolna EAN-13 / UPC-A (12+1). */
export function isValidEanChecksum(ean: string): boolean {
  const d = digitsOnly(ean);
  if (d.length !== 13 && d.length !== 8) return false;
  const body = d.slice(0, -1);
  const check = Number(d.slice(-1));
  let sum = 0;
  // od prawej: wagi 3,1,3,1…
  const chars = body.split('').reverse();
  for (let i = 0; i < chars.length; i++) {
    const n = Number(chars[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

function collectIssues(products: Product[]): EanIssue[] {
  const byEan = new Map<string, Product[]>();
  const issues: EanIssue[] = [];

  for (const p of products) {
    if (p.isGroup) continue;
    const raw = (p.ean || '').trim();
    if (!raw) {
      issues.push({ product: p, kind: 'missing', detail: 'Brak EAN' });
      continue;
    }
    const d = digitsOnly(raw);
    if (d.length !== 8 && d.length !== 13) {
      issues.push({
        product: p,
        kind: 'format',
        detail: `Nie 8/13 cyfr (${raw})`,
      });
      continue;
    }
    if (!isValidEanChecksum(d)) {
      issues.push({
        product: p,
        kind: 'checksum',
        detail: `Zła suma kontrolna (${d})`,
      });
    }
    const list = byEan.get(d) || [];
    list.push(p);
    byEan.set(d, list);
  }

  for (const [ean, list] of byEan) {
    if (list.length < 2) continue;
    for (const p of list) {
      issues.push({
        product: p,
        kind: 'duplicate',
        detail: `Duplikat EAN ${ean} (${list.length} SKU)`,
      });
    }
  }

  const order: Record<IssueKind, number> = {
    duplicate: 0,
    checksum: 1,
    format: 2,
    missing: 3,
  };
  return issues.sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      a.product.sku.localeCompare(b.product.sku, 'pl'),
  );
}

const KIND_LABEL: Record<IssueKind, string> = {
  missing: 'Brak',
  format: 'Format',
  checksum: 'Checksum',
  duplicate: 'Duplikat',
};

export function EanHygieneView({
  products,
  onOpenProduct,
  onClose,
}: EanHygieneViewProps) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<IssueKind | 'all'>('all');

  const issues = useMemo(() => collectIssues(products), [products]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return issues.filter((i) => {
      if (kind !== 'all' && i.kind !== kind) return false;
      if (!s) return true;
      return (
        i.product.sku.toLowerCase().includes(s) ||
        i.product.displayName.toLowerCase().includes(s) ||
        (i.product.ean || '').toLowerCase().includes(s) ||
        i.detail.toLowerCase().includes(s)
      );
    });
  }, [issues, q, kind]);

  const counts = useMemo(() => {
    const c: Record<IssueKind | 'all', number> = {
      all: issues.length,
      missing: 0,
      format: 0,
      checksum: 0,
      duplicate: 0,
    };
    for (const i of issues) c[i.kind]++;
    return c;
  }, [issues]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Higiena EAN
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Podejrzane kody — popraw ręcznie w karcie produktu. Bez auto-naprawy.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', 'Wszystkie'],
            ['duplicate', 'Duplikaty'],
            ['checksum', 'Checksum'],
            ['format', 'Format'],
            ['missing', 'Brak'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              kind === id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-100'
            }`}
          >
            {label} {counts[id]}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SKU / nazwa / EAN…"
          className="input-field with-icon"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-12 text-center text-sm text-slate-500">
          Brak problemów w tym filtrze
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtered.slice(0, 300).map((i) => (
            <li key={`${i.product.id}-${i.kind}-${i.detail}`}>
              <button
                type="button"
                onClick={() => onOpenProduct(i.product)}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-left hover:border-brand-500/40"
              >
                <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  {KIND_LABEL[i.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {i.product.displayName}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-slate-500">
                    {i.product.sku}
                    {i.product.ean ? ` · ${i.product.ean}` : ''}
                  </span>
                </span>
                <span className="max-w-[40%] truncate text-[11px] text-slate-400">
                  {i.detail}
                </span>
              </button>
            </li>
          ))}
          {filtered.length > 300 && (
            <p className="py-2 text-center text-xs text-slate-500">
              Pokazano 300 z {filtered.length} — zawęź filtr
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
