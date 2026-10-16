import { AlertCircle, CheckCircle2, CloudDownload, CloudUpload, Loader2 } from 'lucide-react';
import {
  DESC_FIELDS,
  charCount,
  fieldState,
  sanitizeDescriptionHtml,
  toEditorHtml,
  type DescFieldDef,
  type DescKey,
  type DescValues,
} from '../../lib/productDescriptions';
import { RichTextField } from './RichTextField';

const STATE_LABEL = { empty: 'brak', short: 'za krótki', ok: 'OK' } as const;
const STATE_CLASS = {
  empty: 'bg-rose-500/15 text-rose-300',
  short: 'bg-amber-500/15 text-amber-300',
  ok: 'bg-emerald-500/15 text-emerald-300',
} as const;

function Counter({ def, value }: { def: DescFieldDef; value: string }) {
  const n = charCount(value);
  const state = fieldState(def, value);
  const over = def.maxChars != null && n > def.maxChars;
  return (
    <span className="flex items-center gap-2 text-[11px]">
      <span className={`tabular-nums ${over ? 'text-amber-300' : 'text-slate-500'}`}>
        {n}
        {def.maxChars ? ` / ${def.maxChars}` : ` (min. ${def.minChars})`} zn.
      </span>
      <span className={`rounded-full px-2 py-0.5 font-semibold ${STATE_CLASS[state]}`}>{STATE_LABEL[state]}</span>
    </span>
  );
}

/** Pasek akcji BaseLinker (pobranie / wysłanie opisów). */
export function DescriptionBlBar({
  busy,
  onPull,
  onPush,
  canPush = true,
}: {
  busy: 'pull' | 'push' | null;
  onPull: () => void;
  onPush: () => void;
  canPush?: boolean;
}) {
  const btn =
    'inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3">
      <span className="mr-auto text-xs text-slate-400">
        Opisy możesz zsynchronizować z BaseLinkerem: pobrać gotowe teksty albo wysłać te z katalogu.
      </span>
      <button type="button" disabled={busy !== null} onClick={onPull} className={btn}>
        {busy === 'pull' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
        Pobierz z BaseLinkera
      </button>
      {canPush && (
        <button type="button" disabled={busy !== null} onClick={onPush} className={btn}>
          {busy === 'push' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
          Wyślij do BaseLinkera
        </button>
      )}
    </div>
  );
}

/** Edycja wszystkich pól opisowych produktu. */
export function ProductDescriptionsEditor({
  values,
  onChange,
  resetKey,
}: {
  values: DescValues;
  onChange: (key: DescKey, value: string) => void;
  /** Zmiana wartości wymusza odświeżenie edytorów (np. po pobraniu z BaseLinkera). */
  resetKey: number;
}) {
  return (
    <div className="space-y-4">
      {DESC_FIELDS.map((def) => (
        <section key={`${def.key}-${resetKey}`} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{def.label}</h4>
              <p className="text-[11px] text-slate-500">{def.hint}</p>
            </div>
            <Counter def={def} value={values[def.key]} />
          </div>
          {def.rich ? (
            <RichTextField
              value={toEditorHtml(values[def.key])}
              onChange={(html) => onChange(def.key, html)}
              minHeight={def.key === 'description' ? 260 : 110}
              placeholder={def.hint}
            />
          ) : (
            <textarea
              value={values[def.key]}
              onChange={(e) => onChange(def.key, e.target.value)}
              rows={3}
              className="input-field resize-y leading-relaxed"
              placeholder={def.hint}
            />
          )}
        </section>
      ))}
    </div>
  );
}

/** Podgląd opisów (tryb bez edycji). */
export function ProductDescriptionsView({
  values,
  loading,
  loadError,
}: {
  values: DescValues;
  loading: boolean;
  loadError: boolean;
}) {
  const filled = DESC_FIELDS.filter((d) => charCount(values[d.key]) > 0);
  const missing = DESC_FIELDS.filter((d) => charCount(values[d.key]) === 0);
  return (
    <div className="space-y-3">
      {loading && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Ładuję opisy produktu…
        </p>
      )}
      {loadError && (
        <p className="flex items-center gap-2 text-sm text-amber-300">
          <AlertCircle className="h-4 w-4" /> Nie udało się pobrać pełnego opisu z bazy. Spróbuj odświeżyć produkt.
        </p>
      )}
      {filled.map((def) => (
        <section key={def.key} className="rounded-2xl border border-slate-800 bg-white p-4 dark:bg-slate-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{def.label}</p>
          <div
            className="rich-desc mt-2 text-sm leading-relaxed text-slate-200 dark:text-slate-300"
            dangerouslySetInnerHTML={{
              __html: def.rich
                ? sanitizeDescriptionHtml(toEditorHtml(values[def.key]))
                : sanitizeDescriptionHtml(toEditorHtml(values[def.key])),
            }}
          />
        </section>
      ))}
      {!loading && filled.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          Brak opisów — dodaj je w trybie edycji albo pobierz z BaseLinkera.
        </div>
      )}
      {missing.length > 0 && filled.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="h-3.5 w-3.5" /> Do uzupełnienia:
          {missing.map((d) => (
            <span key={d.key} className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
              {d.label}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
