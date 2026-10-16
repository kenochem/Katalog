import { Bold, Code2, Eraser, Heading3, Italic, Link2, List, ListOrdered, Underline } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { sanitizeDescriptionHtml } from '../../lib/productDescriptions';

type Cmd = { icon: typeof Bold; title: string; run: () => void };

/** Prosty edytor z formatowaniem (pogrubienie, nagłówek, listy, link) zapisujący czysty HTML. */
export function RichTextField({
  value,
  onChange,
  minHeight = 160,
  placeholder = '',
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(false);
  const lastEmitted = useRef(value);

  // zewnętrzna zmiana wartości (np. pobranie z BaseLinkera) — odśwież edytor, ale nie w trakcie pisania
  useEffect(() => {
    const el = ref.current;
    if (!el || source) return;
    if (value !== lastEmitted.current || el.innerHTML === '' ) {
      if (document.activeElement !== el || value !== lastEmitted.current) {
        el.innerHTML = value;
        lastEmitted.current = value;
      }
    }
  }, [value, source]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeDescriptionHtml(el.innerHTML);
    lastEmitted.current = clean;
    onChange(clean);
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  const cmds: Cmd[] = [
    { icon: Bold, title: 'Pogrubienie', run: () => exec('bold') },
    { icon: Italic, title: 'Kursywa', run: () => exec('italic') },
    { icon: Underline, title: 'Podkreślenie', run: () => exec('underline') },
    { icon: Heading3, title: 'Nagłówek', run: () => exec('formatBlock', 'h3') },
    { icon: List, title: 'Lista punktowana', run: () => exec('insertUnorderedList') },
    { icon: ListOrdered, title: 'Lista numerowana', run: () => exec('insertOrderedList') },
    {
      icon: Link2,
      title: 'Link',
      run: () => {
        const url = window.prompt('Adres linku (https://…)');
        if (url) exec('createLink', url);
      },
    },
    { icon: Eraser, title: 'Wyczyść formatowanie', run: () => exec('removeFormat') },
  ];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/40 focus-within:border-brand-500">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 px-2 py-1.5">
        {cmds.map(({ icon: Icon, title, run }) => (
          <button
            key={title}
            type="button"
            title={title}
            aria-label={title}
            disabled={source}
            onMouseDown={(e) => {
              e.preventDefault();
              run();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <button
          type="button"
          title="Podgląd kodu HTML"
          aria-label="Kod HTML"
          onClick={() => setSource((s) => !s)}
          className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
            source ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" /> HTML
        </button>
      </div>
      {source ? (
        <textarea
          value={value}
          onChange={(e) => {
            lastEmitted.current = e.target.value;
            onChange(e.target.value);
          }}
          onBlur={() => onChange(sanitizeDescriptionHtml(value))}
          style={{ minHeight }}
          className="block w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            e.preventDefault();
            const html = e.clipboardData.getData('text/html');
            const text = e.clipboardData.getData('text/plain');
            const clean = html ? sanitizeDescriptionHtml(html) : text.replace(/\n/g, '<br>');
            document.execCommand('insertHTML', false, clean);
            emit();
          }}
          style={{ minHeight }}
          className="rich-desc p-3 text-sm leading-relaxed text-slate-100 outline-none empty:before:text-slate-500 empty:before:content-[attr(data-placeholder)]"
        />
      )}
    </div>
  );
}
