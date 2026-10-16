import { useMemo, useState } from 'react';
import { manufacturerOptions } from '../lib/waproManufacturers';
import { cleanManufacturerName, registerManufacturers, useManufacturerRegistry } from '../lib/manufacturerRegistry';
import { showToast } from '../lib/toast';

const NEW = '__new__';

/** Lista producentów (WAPRO + dodani ręcznie + z BaseLinkera) z możliwością dodania nowego. */
export function ManufacturerSelect({
  value,
  onChange,
  extra = [],
  className = 'input-field',
}: {
  value: string;
  onChange: (next: string) => void;
  /** Dodatkowe nazwy (np. producent bieżącego produktu spoza listy). */
  extra?: Array<string | undefined | null>;
  className?: string;
}) {
  const registryVersion = useManufacturerRegistry();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => manufacturerOptions([...extra, value].filter(Boolean) as string[]), [registryVersion, value, extra.join('|')]);

  async function commit() {
    const name = cleanManufacturerName(draft);
    if (!name) {
      setAdding(false);
      return;
    }
    setBusy(true);
    try {
      await registerManufacturers([{ name }], 'manual');
      const exact = options.find((o) => o.toLowerCase() === name.toLowerCase());
      onChange(exact ?? name);
      showToast(`Producent „${exact ?? name}” dodany do listy`, 'ok');
      setAdding(false);
      setDraft('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się dodać producenta', 'error', 6000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <select
        value={adding ? NEW : value}
        onChange={(e) => {
          if (e.target.value === NEW) {
            setAdding(true);
            return;
          }
          setAdding(false);
          onChange(e.target.value);
        }}
        className={className}
      >
        <option value="">— wybierz —</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={NEW}>+ Nowy producent…</option>
      </select>
      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              }
            }}
            placeholder="Nazwa nowego producenta / marki"
            className="input-field min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => void commit()}
            className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {busy ? 'Dodaję…' : 'Dodaj'}
          </button>
        </div>
      )}
    </>
  );
}
