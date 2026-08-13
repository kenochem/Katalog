import { ChevronDown, ChevronUp, Plus, Trash2, LayoutGrid } from 'lucide-react';
import type { LayoutElement } from '../../lib/warehouseLayoutStore';
import { elementDef } from '../../lib/warehouseLayoutStore';
import {
  RACK_SECTION_TEMPLATES,
  ensureRackSections,
  formatRackSectionLocation,
  moveSection,
  sectionDraft,
  type RackSection,
  type RackSectionTemplateId,
} from '../../lib/rackSections';

interface WarehouseRackConfiguratorProps {
  element: LayoutElement;
  accent: string;
  onUpdate: (patch: Partial<LayoutElement>) => void;
}

export function WarehouseRackConfigurator({
  element,
  accent,
  onUpdate,
}: WarehouseRackConfiguratorProps) {
  const sections = ensureRackSections(element);
  const def = elementDef(element.type);

  function setSections(next: RackSection[]) {
    onUpdate({ sections: next });
  }

  function applyTemplate(id: RackSectionTemplateId) {
    const t = RACK_SECTION_TEMPLATES.find((x) => x.id === id);
    if (t) setSections(t.build());
  }

  function patchSection(id: string, patch: Partial<RackSection>) {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <div className="wh-rack-configurator overflow-hidden rounded-2xl border border-emerald-500/25 bg-white shadow-sm dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/95 dark:shadow-lg dark:shadow-black/20">
      <div className="border-b border-emerald-500/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Konfigurator regału</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-500">Sekcje towaru — półki, palety, kuwety</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(7rem,9rem)_1fr]">
        <div
          className="wh-rack-preview flex min-h-[10rem] flex-col-reverse overflow-hidden rounded-xl border-2 shadow-inner"
          style={{ borderColor: accent, background: `${accent}12` }}
        >
          {sections.map((sec) => (
            <div
              key={sec.id}
              className="wh-rack-preview-shelf flex min-h-[2rem] flex-1 flex-col items-center justify-center border-t px-1 py-1"
              style={{ borderColor: `${accent}44` }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wide text-slate-950 dark:text-slate-200">
                {sec.shelfCode || sec.label.slice(0, 6)}
              </span>
              {sec.bins > 1 ? (
                <span className="text-[8px] text-slate-500">{sec.bins}×</span>
              ) : null}
            </div>
          ))}
          <div
            className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: accent }}
          >
            Podłoga
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              Szablony sekcji
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RACK_SECTION_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.description}
                  onClick={() => applyTemplate(t.id)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:border-emerald-500/40 hover:text-emerald-800 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:text-emerald-200"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-[min(40vh,16rem)] space-y-2 overflow-y-auto pr-0.5">
            {sections.map((sec, index) => (
              <li
                key={sec.id}
                className="wh-rack-section-row rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700/80 dark:bg-slate-900/70"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-500">
                    Poziom {sections.length - index}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      aria-label="Wyżej"
                      disabled={index === sections.length - 1}
                      onClick={() => setSections(moveSection(sections, sec.id, 1))}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Niżej"
                      disabled={index === 0}
                      onClick={() => setSections(moveSection(sections, sec.id, -1))}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Usuń sekcję"
                      disabled={sections.length <= 1}
                      onClick={() => setSections(sections.filter((s) => s.id !== sec.id))}
                      className="rounded p-1 text-red-400/80 hover:bg-red-500/10 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-500">
                  Nazwa
                  <input
                    className="input-field mt-0.5 w-full py-1 text-xs"
                    value={sec.label}
                    onChange={(e) => patchSection(sec.id, { label: e.target.value })}
                  />
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-[10px] text-slate-600 dark:text-slate-500">
                    Kod półki
                    <input
                      className="input-field mt-0.5 w-full py-1 font-mono text-xs uppercase"
                      value={sec.shelfCode ?? ''}
                      placeholder="P04"
                      onChange={(e) =>
                        patchSection(sec.id, { shelfCode: e.target.value.trim() || undefined })
                      }
                    />
                  </label>
                  <label className="block text-[10px] text-slate-600 dark:text-slate-500">
                    Kuwety / rząd
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className="input-field mt-0.5 w-full py-1 tabular-nums text-xs"
                      value={sec.bins}
                      onChange={(e) =>
                        patchSection(sec.id, { bins: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>
                </div>
                <p className="mt-1.5 truncate font-mono text-[10px] text-emerald-400/90">
                  {formatRackSectionLocation(element, sec)}
                </p>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() =>
              setSections([
                ...sections,
                sectionDraft(`Półka ${sections.length + 1}`, `P${sections.length + 1}`, 4),
              ])
            }
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-500/35 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300/90 dark:hover:bg-emerald-500/5"
          >
            <Plus className="h-3.5 w-3.5" />
            Dodaj sekcję
          </button>
        </div>
      </div>

      <p className="border-t border-slate-200 px-4 py-2 text-[10px] text-slate-600 dark:border-slate-800/80">
        {sections.length} poziomów · {def.label} — każda sekcja = osobny preset lokalizacji przy SKU
      </p>
    </div>
  );
}

export function RackSectionsCanvasOverlay({
  sections,
  accent,
  highlightSectionId,
}: {
  sections: RackSection[];
  accent: string;
  highlightSectionId?: string;
}) {
  if (!sections.length) return null;
  return (
    <div className="pointer-events-none absolute inset-1 flex flex-col-reverse gap-px overflow-hidden rounded-md">
      {sections.map((sec) => {
        const isSec = highlightSectionId === sec.id;
        return (
        <div
          key={sec.id}
          className={`flex min-h-0 flex-1 items-center justify-center border-t px-0.5 ${
            isSec ? 'wh-rack-section--highlight z-[1] border-emerald-400/80' : 'border-white/10'
          }`}
          style={{ background: isSec ? 'rgb(52 211 153 / 0.35)' : `${accent}18` }}
        >
          <span className="max-w-full truncate text-[7px] font-semibold leading-none text-slate-100/90">
            {sec.shelfCode || sec.label}
          </span>
        </div>
        );
      })}
    </div>
  );
}
