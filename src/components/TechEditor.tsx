import { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Product } from '../types';
import {
  MATERIAL_LABEL,
  TECH_SUBTYPES,
  TECH_TYPES,
  parseThreads,
  rebuildDisplayName,
  threadLabel,
  type Material,
  type TechAttrs,
  type TechType,
} from '../lib/techParser';
import { saveTechRecords } from '../lib/techStore';
import { showToast } from '../lib/toast';

/** Edytor opisu technicznego produktu (typ, podtyp, gwinty, materiał, kod dyszy) — z listy grup i z karty produktu. */
export function EntryEditor({
  entry,
  who,
  onClose,
}: {
  entry: { product: Product; type: TechType; subtype: string; attrs: TechAttrs };
  who: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<TechType>(entry.type);
  const [subtype, setSubtype] = useState(entry.subtype);
  const [material, setMaterial] = useState<string>(entry.attrs.material ?? '');
  const [endsText, setEndsText] = useState(entry.attrs.ends.map(threadLabel).join(' - '));
  const [code, setCode] = useState(entry.attrs.code ?? '');
  const [orifice, setOrifice] = useState(entry.attrs.orifice ?? '');
  const [series, setSeries] = useState(entry.attrs.series ?? '');
  const [bar, setBar] = useState(entry.attrs.maxBar ? String(entry.attrs.maxBar) : '');
  const [nameOverride, setNameOverride] = useState('');
  const [busy, setBusy] = useState(false);

  const attrs: TechAttrs = useMemo(
    () => ({
      ...entry.attrs,
      ends: parseThreads(endsText.replace(/″/g, '')),
      material: (material || undefined) as Material | undefined,
      code: code.trim() || undefined,
      orifice: orifice.trim() || undefined,
      series: series.trim() || undefined,
      maxBar: bar ? Number(bar) || undefined : undefined,
    }),
    [entry.attrs, endsText, material, code, orifice, series, bar],
  );
  const preview = rebuildDisplayName(type, subtype, attrs);

  async function save() {
    setBusy(true);
    try {
      await saveTechRecords(
        [{ sku: entry.product.sku, type, subtype, attrs, displayName: nameOverride.trim() || preview }],
        who,
      );
      showToast('Zapisano opis techniczny', 'ok');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 8000);
    } finally {
      setBusy(false);
    }
  }

  const inp =
    'w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-500';
  const lab = 'block text-[11px] font-medium text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-50">Opis techniczny</h3>
            <p className="truncate text-xs text-slate-400">
              WAPRO: {entry.product.name} · <span className="font-mono">{entry.product.sku}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={lab}>
            Typ
            <select
              className={inp}
              value={type}
              onChange={(e) => {
                const t = e.target.value as TechType;
                setType(t);
                setSubtype(TECH_SUBTYPES[t][0].id);
              }}
            >
              {TECH_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={lab}>
            Podtyp
            <select className={inp} value={subtype} onChange={(e) => setSubtype(e.target.value)}>
              {TECH_SUBTYPES[type].map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className={lab}>
            Materiał
            <select className={inp} value={material} onChange={(e) => setMaterial(e.target.value)}>
              <option value="">—</option>
              {(Object.keys(MATERIAL_LABEL) as Material[]).map((m) => (
                <option key={m} value={m}>
                  {MATERIAL_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className={lab}>
            Ciśnienie maks. (bar)
            <input className={inp} value={bar} onChange={(e) => setBar(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className={`${lab} col-span-2`}>
            Gwinty / końcówki (np. „GZ3/8 - GW1/4” albo „1/4M - 3/8Ż”)
            <input className={inp} value={endsText} onChange={(e) => setEndsText(e.target.value)} />
          </label>
          {type === 'dysza' && (
            <>
              <label className={lab}>
                Kod (np. 25-040)
                <input className={inp} value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label className={lab}>
                Rozmiar otworu (np. 075)
                <input className={inp} value={orifice} onChange={(e) => setOrifice(e.target.value)} />
              </label>
              <label className={`${lab} col-span-2`}>
                Seria / marka (np. HB, LP, ROTJET)
                <input className={inp} value={series} onChange={(e) => setSeries(e.target.value)} />
              </label>
            </>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
          <p className="text-[11px] text-slate-500">Nazwa katalogowa (podgląd)</p>
          <p className="text-sm font-semibold text-slate-100">{nameOverride.trim() || preview}</p>
          <input
            className={`${inp} mt-2`}
            placeholder="Własna nazwa katalogowa (opcjonalnie)"
            value={nameOverride}
            onChange={(e) => setNameOverride(e.target.value)}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200">
            Anuluj
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Zapisz i zatwierdź
          </button>
        </div>
      </div>
    </div>
  );
}
