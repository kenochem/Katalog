import { Search, X, ScanLine, Check } from 'lucide-react';
import { useRef, useState } from 'react';
interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onScanClick?: () => void;
}

export function SearchBar({ value, onChange, placeholder, onScanClick }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  function dismissKeyboard() {
    inputRef.current?.blur();
    setFocused(false);
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        dismissKeyboard();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // małe opóźnienie, żeby klik w „Gotowe” zdążył zadziałać
            window.setTimeout(() => setFocused(false), 150);
          }}
          placeholder={placeholder ?? 'Nazwa, SKU lub EAN...'}
          className={`w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-11 text-base text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 sm:py-3 ${
            focused || value ? 'pr-20' : 'pr-10'
          }`}
          autoComplete="off"
          // iOS: bez auto-zoom przy focus (font >= 16px już jest)
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {value ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange('')}
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
              aria-label="Wyczyść"
              title="Wyczyść"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          {focused ? (
            <button
              type="submit"
              onMouseDown={(e) => e.preventDefault()}
              className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold text-white hover:bg-brand-500"
              aria-label="Gotowe — zamknij klawiaturę"
              title="Gotowe"
            >
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                Gotowe
              </span>
            </button>
          ) : null}
        </div>
      </div>
      {onScanClick && (
        <button
          type="button"
          onClick={onScanClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-500/40 bg-brand-500/10 text-brand-300 transition hover:bg-brand-500/20"
          title="Skanuj kod kreskowy"
          aria-label="Skanuj kod kreskowy"
        >
          <ScanLine className="h-5 w-5" />
        </button>
      )}
    </form>
  );
}
