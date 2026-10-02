const VAT_RATE = 0.23;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseAmount(raw: string): number {
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

interface NetGrossPriceInputProps {
  /** Wartość kanoniczna — magazyn danych zawsze trzyma netto. */
  net: number;
  onChangeNet: (net: number) => void;
  /** Kompaktowy wariant do wąskich komórek tabeli (desktop). */
  compact?: boolean;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Dwa zsynchronizowane pola — netto (główne, większe) i brutto (pod spodem,
 * mniejsze) — edycja jednego przelicza drugie. Zgodnie z resztą apki: ładna
 * cena netto na górze, mała brutto pod spodem — tu obie są edytowalne.
 */
export function NetGrossPriceInput({
  net,
  onChangeNet,
  compact = false,
  align = 'left',
  className = '',
}: NetGrossPriceInputProps) {
  const gross = round2(net * (1 + VAT_RATE));
  const textAlign = align === 'right' ? 'text-right' : '';
  const netSize = compact ? 'text-xs' : 'text-sm';
  const netWidth = compact ? 'w-24' : 'w-full';
  const grossWidth = compact ? 'w-24' : 'w-full';

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <input
        type="number"
        min={0}
        step={0.01}
        value={net}
        onChange={(e) => onChangeNet(parseAmount(e.target.value))}
        aria-label="Cena netto"
        title="Cena netto"
        className={`input-field ${netWidth} ${netSize} ${textAlign} font-semibold tabular-nums`}
      />
      <input
        type="number"
        min={0}
        step={0.01}
        value={gross}
        onChange={(e) => onChangeNet(round2(parseAmount(e.target.value) / (1 + VAT_RATE)))}
        aria-label="Cena brutto"
        title="Cena brutto"
        className={`input-field ${grossWidth} text-[11px] ${textAlign} text-slate-500 tabular-nums`}
      />
    </div>
  );
}
