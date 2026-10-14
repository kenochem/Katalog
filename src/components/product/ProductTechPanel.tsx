import { useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Wrench } from 'lucide-react';
import type { Product } from '../../types';
import { useAuth } from '../../lib/auth';
import { confirmDialog } from '../../lib/dialog';
import { showToast } from '../../lib/toast';
import { TECH_TYPE_PLURAL, TECH_SUBTYPES, parseTechName, subtypeLabel, type TechAttrs, type TechType } from '../../lib/techParser';
import { deleteTechRecord, getTechRecord, saveTechRecords, useTechVersion } from '../../lib/techStore';
import { EntryEditor } from '../TechEditor';
import { TechTypeIcon } from '../TechTypeIcon';

interface Props {
  product: Product;
  canEdit: boolean;
  onOpenGroups?: () => void;
}

const EMPTY_ATTRS: TechAttrs = { ends: [] };

/** Karta produktu: do jakiej grupy technicznej należy produkt + przypisanie / poprawa / zatwierdzenie. */
export function ProductTechPanel({ product, canEdit, onOpenGroups }: Props) {
  const ver = useTechVersion();
  const { displayLabel } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const state = useMemo(() => {
    const rec = getTechRecord(product.sku);
    if (rec) return { kind: rec.status === 'rejected' ? ('rejected' as const) : ('approved' as const), rec };
    const parsed = parseTechName(product.name);
    return parsed ? { kind: 'proposed' as const, parsed } : { kind: 'none' as const };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.sku, product.name, ver]);

  if (product.isGroup) return null;
  if (state.kind === 'none' && !canEdit) return null;
  if (state.kind === 'rejected' && !canEdit) return null;

  const current =
    state.kind === 'approved'
      ? { type: state.rec.type, subtype: state.rec.subtype, attrs: state.rec.attrs, name: state.rec.displayName }
      : state.kind === 'proposed'
        ? { type: state.parsed.type, subtype: state.parsed.subtype, attrs: state.parsed.attrs, name: state.parsed.displayName }
        : null;

  async function approve() {
    if (!current) return;
    setBusy(true);
    try {
      await saveTechRecords(
        [{ sku: product.sku, type: current.type, subtype: current.subtype, attrs: current.attrs, displayName: current.name }],
        displayLabel,
      );
      showToast('Zatwierdzono opis techniczny', 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error', 8000);
    } finally {
      setBusy(false);
    }
  }

  async function exclude() {
    const type: TechType = current?.type ?? 'nypel';
    if (
      !(await confirmDialog({
        title: 'Wyłączyć z grup produktów?',
        message: 'Produkt zniknie z grup technicznych (nazwa w WAPRO bez zmian). Możesz go potem przypisać ponownie.',
        confirmLabel: 'Wyłącz',
      }))
    )
      return;
    setBusy(true);
    try {
      await saveTechRecords(
        [{ sku: product.sku, type, subtype: current?.subtype ?? TECH_SUBTYPES[type][0].id, attrs: current?.attrs ?? EMPTY_ATTRS, status: 'rejected' }],
        displayLabel,
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error', 8000);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await deleteTechRecord(product.sku);
      showToast('Cofnięto do propozycji z nazwy', 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się cofnąć', 'error', 8000);
    } finally {
      setBusy(false);
    }
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Wrench className="h-3.5 w-3.5" /> Grupa produktu
        </p>
        {onOpenGroups && state.kind !== 'none' && state.kind !== 'rejected' && (
          <button type="button" onClick={onOpenGroups} className="text-[11px] text-slate-400 underline hover:text-slate-200">
            Otwórz grupy
          </button>
        )}
      </div>

      {current ? (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <TechTypeIcon type={current.type} className="h-5 w-5 shrink-0 text-slate-300" />
            {current.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {TECH_TYPE_PLURAL[current.type]} › {subtypeLabel(current.type, current.subtype)}
            {state.kind === 'proposed' && (
              <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                propozycja z nazwy
              </span>
            )}
            {state.kind === 'proposed' && state.parsed.confidence === 'review' && (
              <span className="ml-1 text-amber-300">· do sprawdzenia: {state.parsed.reasons.join('; ')}</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">Nazwa w WAPRO: {product.name}</p>
        </>
      ) : (
        <p className="text-sm text-slate-400">
          {state.kind === 'rejected' ? 'Wyłączony z grup produktów.' : 'Nie przypisano do żadnej grupy produktów.'}
        </p>
      )}

      {canEdit && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {state.kind === 'proposed' && (
            <button type="button" disabled={busy} onClick={() => void approve()} className={`${btn} border-emerald-600 text-emerald-300`}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Zatwierdź
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className={btn}>
            <Pencil className="h-3.5 w-3.5" />
            {current ? 'Zmień grupę / parametry' : 'Przypisz do grupy'}
          </button>
          {state.kind === 'approved' && (
            <button type="button" disabled={busy} onClick={() => void reset()} className={btn} title="Usuń zatwierdzony opis i wróć do propozycji z nazwy">
              Cofnij do propozycji
            </button>
          )}
          {(state.kind === 'approved' || state.kind === 'proposed') && (
            <button type="button" disabled={busy} onClick={() => void exclude()} className={btn}>
              Wyłącz z grup
            </button>
          )}
        </div>
      )}

      {editing && (
        <EntryEditor
          entry={{
            product,
            type: current?.type ?? 'nypel',
            subtype: current?.subtype ?? TECH_SUBTYPES.nypel[0].id,
            attrs: current?.attrs ?? EMPTY_ATTRS,
          }}
          who={displayLabel}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
