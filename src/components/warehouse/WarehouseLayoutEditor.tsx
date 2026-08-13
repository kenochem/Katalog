import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Grid3x3,
  Layers,
  MousePointer2,
  Settings2,
  Trash2,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { showToast } from '../../lib/toast';
import {
  LAYOUT_CELL_PX,
  LAYOUT_ELEMENT_DEFS,
  LAYOUT_GRID_LIMITS,
  LAYOUT_GRID_PRESETS,
  WAREHOUSE_LAYOUT_SCOPE,
  applyRackTemplate,
  clampLayoutElement,
  createLayoutElement,
  elementDef,
  formatElementLocation,
  isRackElementType,
  layoutCellCssType,
  loadWarehouseLayout,
  resizeLayoutGrid,
  saveWarehouseLayout,
  seedKenochemWarehouseLayout,
  loadWarehouseCanvasTheme,
  saveWarehouseCanvasTheme,
  type WarehouseCanvasTheme,
  type LayoutElement,
  type LayoutElementType,
  type WarehouseLayoutMap,
} from '../../lib/warehouseLayoutStore';
import { ensureRackSections } from '../../lib/rackSections';
import {
  RackSectionsCanvasOverlay,
  WarehouseRackConfigurator,
} from './WarehouseRackConfigurator';
import { WarehouseLayoutScaleRulers } from './WarehouseLayoutScaleRulers';
import {
  formatElementFootprintMeters,
  formatFootprintMeters,
  LAYOUT_CELL_DISPLAY_PX_LIMITS,
  LAYOUT_METER_LIMITS,
  LAYOUT_METER_PRESETS,
  clampMetersPerCell,
  resolveCellDisplayPx,
  resolveMetersPerCell,
} from '../../lib/warehouseLayoutMetrics';

interface WarehouseLayoutEditorProps {
  onBack: () => void;
  onOpenLocations?: () => void;
  scopeId?: string;
}

type DragMode = 'move' | 'resize' | null;

type PaletteGroupId = 'racks' | 'facility' | 'logistics' | 'structure';

const PALETTE_GROUPS: { id: PaletteGroupId; title: string }[] = [
  { id: 'racks', title: 'Regały' },
  { id: 'logistics', title: 'Operacje' },
  { id: 'structure', title: 'Układ hali' },
  { id: 'facility', title: 'Pomieszczenia' },
];

export function WarehouseLayoutEditor({
  onBack,
  onOpenLocations,
  scopeId = WAREHOUSE_LAYOUT_SCOPE,
}: WarehouseLayoutEditorProps) {
  const [layout, setLayout] = useState<WarehouseLayoutMap>(() => loadWarehouseLayout(scopeId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paintType, setPaintType] = useState<LayoutElementType | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [gridDraft, setGridDraft] = useState({ cols: layout.cols, rows: layout.rows });
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [canvasTheme, setCanvasTheme] = useState<WarehouseCanvasTheme>(() =>
    loadWarehouseCanvasTheme(),
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    id: string;
    startX: number;
    startY: number;
    orig: LayoutElement;
  } | null>(null);

  useEffect(() => {
    seedKenochemWarehouseLayout(scopeId);
    const loaded = loadWarehouseLayout(scopeId);
    setLayout(loaded);
    setGridDraft({ cols: loaded.cols, rows: loaded.rows });
  }, [scopeId]);

  useEffect(() => {
    setGridDraft({ cols: layout.cols, rows: layout.rows });
  }, [layout.cols, layout.rows]);

  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent).detail as { scopeId?: string } | undefined;
      if (detail?.scopeId && detail.scopeId !== scopeId) return;
      setLayout(loadWarehouseLayout(scopeId));
    }
    window.addEventListener('katalog-wh-layout-changed', onChanged);
    return () => window.removeEventListener('katalog-wh-layout-changed', onChanged);
  }, [scopeId]);

  const persist = useCallback(
    (next: WarehouseLayoutMap) => {
      setLayout(saveWarehouseLayout(scopeId, next));
    },
    [scopeId],
  );

  const selected = layout.elements.find((e) => e.id === selectedId) ?? null;
  const metersPerCell = resolveMetersPerCell(layout.metersPerCell);
  const baseCellPx = resolveCellDisplayPx(layout.cellDisplayPx, LAYOUT_CELL_PX);
  const cellPx = baseCellPx * zoom;
  const hallFootprint = formatFootprintMeters(layout.cols, layout.rows, metersPerCell);

  const defsByGroup = useMemo(() => {
    const map = new Map<PaletteGroupId, (typeof LAYOUT_ELEMENT_DEFS)[number][]>();
    for (const g of PALETTE_GROUPS) map.set(g.id, []);
    for (const def of LAYOUT_ELEMENT_DEFS) {
      const g = def.paletteGroup ?? 'logistics';
      map.get(g)?.push(def);
    }
    return map;
  }, []);

  function updateElement(id: string, patch: Partial<LayoutElement>) {
    persist({
      ...layout,
      elements: layout.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  function deleteElement(id: string) {
    persist({ ...layout, elements: layout.elements.filter((e) => e.id !== id) });
    if (selectedId === id) setSelectedId(null);
    showToast('Element planu usuniety', 'info');
  }

  function duplicateElement(el: LayoutElement) {
    const copy = createLayoutElement(el.type, el.x + 1, el.y + 1, {
      label: `${el.label} (kopia)`,
      zone: el.zone,
      aisle: el.aisle,
      rack: el.rack,
      w: el.w,
      h: el.h,
      color: el.color,
      sections: el.sections?.map((s) => ({ ...s, id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })),
    });
    persist({
      ...layout,
      elements: [...layout.elements, clampLayoutElement(copy, layout.cols, layout.rows)],
    });
    setSelectedId(copy.id);
    showToast('Element planu skopiowany', 'ok');
  }

  function placeAt(gridX: number, gridY: number) {
    if (!paintType) return;
    const el = createLayoutElement(paintType, gridX, gridY);
    const clamped = clampLayoutElement(el, layout.cols, layout.rows);
    persist({ ...layout, elements: [...layout.elements, clamped] });
    setSelectedId(clamped.id);
    setPaintType(null);
    showToast('Dodano element planu magazynu', 'ok');
  }

  function applyGridSize() {
    const next = resizeLayoutGrid(layout, gridDraft.cols, gridDraft.rows);
    persist(next);
    showToast(`Siatka: ${next.cols}×${next.rows}`, 'ok');
  }

  function applyGridPreset(cols: number, rows: number) {
    setGridDraft({ cols, rows });
    const next = resizeLayoutGrid(layout, cols, rows);
    persist(next);
    showToast(`Preset siatki ${cols}×${rows}`, 'info');
  }

  function stretchWallsToGrid() {
    const nextEls = layout.elements.map((el) => {
      if (el.type !== 'wall') return el;
      if (el.y === 0) return { ...el, x: 0, w: layout.cols };
      if (el.y >= layout.rows - 2) return { ...el, x: 0, y: layout.rows - 1, w: layout.cols };
      return el;
    });
    persist({ ...layout, elements: nextEls });
    showToast('Ściany N/S dopasowane do szerokości siatki', 'info');
  }

  function canvasCoords(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { gx: 0, gy: 0 };
    const gx = Math.floor((clientX - rect.left) / cellPx);
    const gy = Math.floor((clientY - rect.top) / cellPx);
    return { gx, gy };
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (dragRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('.wh-layout-cell')) return;
    const { gx, gy } = canvasCoords(e.clientX, e.clientY);
    if (paintType) placeAt(gx, gy);
    else setSelectedId(null);
  }

  function startDrag(e: React.PointerEvent, el: LayoutElement, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(el.id);
    dragRef.current = {
      mode,
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...el },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.startX) / cellPx);
    const dy = Math.round((e.clientY - d.startY) / cellPx);
    if (d.mode === 'move') {
      updateElement(
        d.id,
        clampLayoutElement(
          { ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy },
          layout.cols,
          layout.rows,
        ),
      );
    } else if (d.mode === 'resize') {
      updateElement(
        d.id,
        clampLayoutElement(
          { ...d.orig, w: Math.max(1, d.orig.w + dx), h: Math.max(1, d.orig.h + dy) },
          layout.cols,
          layout.rows,
        ),
      );
    }
  }

  function endDrag() {
    dragRef.current = null;
  }

  function hasLocationFields(type: LayoutElementType) {
    return (
      isRackElementType(type) ||
      type === 'zone' ||
      type === 'packing' ||
      type === 'receiving' ||
      type === 'shipping' ||
      type === 'cold'
    );
  }

  function setCanvasThemeAndSave(next: WarehouseCanvasTheme) {
    setCanvasTheme(next);
    saveWarehouseCanvasTheme(next);
    showToast(next === 'dark' ? 'Mapa magazynu: motyw ciemny' : 'Mapa magazynu: motyw jasny', 'info');
  }

  return (
    <div
      className={`wh-layout-editor wh-layout-theme-${canvasTheme} mx-auto flex max-w-[1600px] flex-col gap-3 pb-10 lg:flex-row lg:items-start`}
    >
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Magazyn
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Plan magazynu</h2>
            <p className="text-xs text-slate-600 dark:text-slate-500">
              Siatka {layout.cols}×{layout.rows} · dopasuj rozmiar hali i typ regałów (paletowe / półkowe).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                settingsOpen ?
                  'border-brand-500/40 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200'
                : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Ustawienia
            </button>
            <button
              type="button"
              onClick={() => setShowGrid((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                showGrid ?
                  'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              Siatka
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))}
              className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label="Pomniejsz"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-500">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label="Powiększ"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            {onOpenLocations && (
              <button
                type="button"
                onClick={onOpenLocations}
                className="rounded-lg border border-brand-500/30 px-2.5 py-1.5 text-xs text-brand-800 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                Przypisz SKU →
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          {PALETTE_GROUPS.map(({ id, title }) => {
            const defs = defsByGroup.get(id) ?? [];
            if (!defs.length) return null;
            return (
              <div key={id} className="flex flex-wrap items-center gap-2">
                <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:w-auto sm:pr-1">
                  {title}
                </span>
                {defs.map((def) => (
                  <button
                    key={def.type}
                    type="button"
                    title={`${def.description} · domyślnie ${formatElementFootprintMeters(def.defaultW, def.defaultH, metersPerCell)}`}
                    onClick={() => {
                      setPaintType(paintType === def.type ? null : def.type);
                      setSelectedId(null);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      paintType === def.type ?
                        'border-emerald-500/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                      : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{def.emoji}</span>
                    {def.label}
                  </button>
                ))}
              </div>
            );
          })}
          {paintType && (
            <p className="flex items-center gap-1 px-1 text-xs text-emerald-400">
              <MousePointer2 className="h-3.5 w-3.5" />
              Kliknij na planie — {elementDef(paintType).description}
            </p>
          )}
        </div>

        <div className="wh-layout-viewport overflow-auto rounded-2xl border p-3">
          <WarehouseLayoutScaleRulers
            cols={layout.cols}
            rows={layout.rows}
            cellPx={cellPx}
            metersPerCell={metersPerCell}
          >
          <div
            ref={canvasRef}
            className={`wh-layout-canvas relative ${showGrid ? 'wh-layout-canvas--grid' : ''}`}
            style={{
              width: layout.cols * cellPx,
              height: layout.rows * cellPx,
              backgroundSize: `${cellPx}px ${cellPx}px`,
            }}
            onClick={onCanvasClick}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            {layout.elements.map((el) => {
              const def = elementDef(el.type);
              const isSelected = selectedId === el.id;
              const cssType = layoutCellCssType(el.type);
              const rackSections = isRackElementType(el.type) ? ensureRackSections(el) : [];
              const accent = el.color ?? def.color;
              return (
                <div
                  key={el.id}
                  className={`wh-layout-cell wh-layout-cell--${cssType} ${isSelected ? 'wh-layout-cell--selected' : ''} ${rackSections.length ? 'wh-layout-cell--has-sections' : ''}`}
                  style={{
                    left: el.x * cellPx,
                    top: el.y * cellPx,
                    width: el.w * cellPx,
                    height: el.h * cellPx,
                    backgroundColor: `${accent}22`,
                    borderColor: accent,
                  }}
                  onPointerDown={(e) => startDrag(e, el, 'move')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(el.id);
                    setPaintType(null);
                  }}
                >
                  {rackSections.length > 0 ?
                    <RackSectionsCanvasOverlay sections={rackSections} accent={accent} />
                  : <>
                      <span className="wh-layout-cell-emoji">{def.emoji}</span>
                      <span className="wh-layout-cell-label">{el.label}</span>
                    </>
                  }
                  {el.zone && isRackElementType(el.type) && (
                    <span className="wh-layout-cell-code relative z-[1]">{formatElementLocation(el)}</span>
                  )}
                  {isSelected && (
                    <button
                      type="button"
                      className="wh-layout-resize"
                      aria-label="Zmień rozmiar"
                      onPointerDown={(e) => startDrag(e, el, 'resize')}
                    />
                  )}
                </div>
              );
            })}
          </div>
          </WarehouseLayoutScaleRulers>
        </div>

        <p className="text-[11px] text-slate-600">
          {layout.elements.length} elementów · siatka {layout.cols}×{layout.rows} kom. ({hallFootprint}) · 1
          kom. = {String(metersPerCell).replace('.', ',')} m · ostatnia zmiana{' '}
          {new Date(layout.updatedAt).toLocaleString('pl-PL')}
        </p>
      </div>

      <aside className="w-full shrink-0 space-y-3 lg:w-[min(100%,26rem)] xl:w-[28rem]">
        {settingsOpen && (
          <div className="space-y-3 rounded-2xl border border-brand-500/20 bg-white p-4 shadow-sm dark:bg-slate-900/60 dark:shadow-none">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-100">
              <Settings2 className="h-4 w-4 text-brand-400" />
              Ustawienia planu
            </p>
            <label className="block text-xs text-slate-500">
              Nazwa hali
              <input
                className="input-field mt-1 w-full py-1.5 text-sm"
                value={layout.name}
                onChange={(e) => persist({ ...layout, name: e.target.value })}
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/80 dark:bg-slate-950/40">
              <p className="mb-2 text-xs font-semibold text-slate-800 dark:text-slate-300">Skala i metraż</p>
              <p className="mb-2 text-[10px] leading-snug text-slate-500">
                Wszystkie wymiary na planie liczymy w komórkach siatki. Ustaw, ile metrów ma jedna komórka — regały,
                alejki i hala będą miały spójny metraż (np. regał 5×3 kom. przy 1 m/kom. = 5 m × 3 m).
              </p>
              <label className="block text-xs text-slate-500">
                1 komórka =
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={LAYOUT_METER_LIMITS.min}
                    max={LAYOUT_METER_LIMITS.max}
                    step={0.25}
                    className="input-field w-full tabular-nums py-1.5 text-sm"
                    value={metersPerCell}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      persist({ ...layout, metersPerCell: clampMetersPerCell(v) });
                    }}
                  />
                  <span className="shrink-0 text-sm text-slate-400">m</span>
                </div>
              </label>
              <div className="mt-2 flex flex-wrap gap-1">
                {LAYOUT_METER_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => persist({ ...layout, metersPerCell: p.value })}
                    className={`rounded-lg border px-2 py-0.5 text-[10px] ${
                      metersPerCell === p.value ?
                        'border-brand-500/50 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-2 py-1.5 text-[11px] tabular-nums text-emerald-900 dark:border-transparent dark:bg-slate-900/80 dark:text-emerald-300/90">
                Powierzchnia siatki: {hallFootprint}
              </p>
              <label className="mt-3 block text-xs text-slate-500">
                Rozmiar komórki na ekranie ({LAYOUT_CELL_DISPLAY_PX_LIMITS.min}–
                {LAYOUT_CELL_DISPLAY_PX_LIMITS.max} px) — zoom nadal w toolbarze
                <input
                  type="range"
                  min={LAYOUT_CELL_DISPLAY_PX_LIMITS.min}
                  max={LAYOUT_CELL_DISPLAY_PX_LIMITS.max}
                  step={1}
                  className="mt-2 w-full accent-brand-500"
                  value={baseCellPx}
                  onChange={(e) =>
                    persist({ ...layout, cellDisplayPx: Number(e.target.value) || baseCellPx })
                  }
                />
                <span className="mt-0.5 block text-[10px] tabular-nums text-slate-600">
                  {baseCellPx} px/kom. · widok {Math.round(zoom * 100)}% → {Math.round(cellPx)} px/kom.
                </span>
              </label>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-slate-500">Motyw siatki planu</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['auto', 'Auto', 'Jak aplikacja'],
                    ['light', 'Jasny', ''],
                    ['dark', 'Ciemny', ''],
                  ] as const
                ).map(([id, label, hint]) => (
                  <button
                    key={id}
                    type="button"
                    title={hint || undefined}
                    onClick={() => setCanvasThemeAndSave(id)}
                    className={`inline-flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition ${
                      canvasTheme === id ?
                        'border-brand-500/50 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {id === 'light' ?
                      <Sun className="h-4 w-4" />
                    : id === 'dark' ?
                      <Moon className="h-4 w-4" />
                    : <Grid3x3 className="h-4 w-4" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-500">
                Kolumny ({LAYOUT_GRID_LIMITS.cols.min}–{LAYOUT_GRID_LIMITS.cols.max})
                <input
                  type="number"
                  min={LAYOUT_GRID_LIMITS.cols.min}
                  max={LAYOUT_GRID_LIMITS.cols.max}
                  className="input-field mt-1 w-full tabular-nums py-1.5 text-sm"
                  value={gridDraft.cols}
                  onChange={(e) =>
                    setGridDraft((d) => ({ ...d, cols: Number(e.target.value) || d.cols }))
                  }
                />
              </label>
              <label className="block text-xs text-slate-500">
                Wiersze ({LAYOUT_GRID_LIMITS.rows.min}–{LAYOUT_GRID_LIMITS.rows.max})
                <input
                  type="number"
                  min={LAYOUT_GRID_LIMITS.rows.min}
                  max={LAYOUT_GRID_LIMITS.rows.max}
                  className="input-field mt-1 w-full tabular-nums py-1.5 text-sm"
                  value={gridDraft.rows}
                  onChange={(e) =>
                    setGridDraft((d) => ({ ...d, rows: Number(e.target.value) || d.rows }))
                  }
                />
              </label>
            </div>
            <button
              type="button"
              onClick={applyGridSize}
              className="w-full rounded-xl bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-500"
            >
              Zastosuj rozmiar siatki
            </button>
            <div className="flex flex-wrap gap-1.5">
              {LAYOUT_GRID_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  title={formatFootprintMeters(p.cols, p.rows, metersPerCell)}
                  onClick={() => applyGridPreset(p.cols, p.rows)}
                  className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={stretchWallsToGrid}
              className="w-full rounded-lg border border-slate-700 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800"
            >
              Dopasuj ściany N/S do szerokości
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-200">
            <Layers className="h-4 w-4 text-emerald-400" />
            Warstwy
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {layout.elements.length === 0 ? (
              <li className="text-slate-500">Brak elementów — wybierz typ i kliknij plan.</li>
            ) : (
              layout.elements.map((el) => (
                <li key={el.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(el.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                      selectedId === el.id ?
                        'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{elementDef(el.type).emoji}</span>
                    <span className="min-w-0 truncate">{el.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {selected ?
          <div className="space-y-3">
            {isRackElementType(selected.type) && (
              <WarehouseRackConfigurator
                element={selected}
                accent={selected.color ?? elementDef(selected.type).color}
                onUpdate={(patch) => updateElement(selected.id, patch)}
              />
            )}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
              {elementDef(selected.type).emoji} {selected.label}
            </p>
            <label className="block text-xs text-slate-500">
              Nazwa
              <input
                className="input-field mt-1 w-full py-1.5 text-sm"
                value={selected.label}
                onChange={(e) => updateElement(selected.id, { label: e.target.value })}
              />
            </label>

            {isRackElementType(selected.type) && (
              <label className="block text-xs text-slate-500">
                Typ regału
                <select
                  className="input-field mt-1 w-full text-sm"
                  value={
                    selected.type === 'rack' || selected.type === 'rack_pallet' || selected.type === 'rack_shelf' ?
                      selected.type
                    : 'rack'
                  }
                  onChange={(e) => {
                    const t = e.target.value as 'rack_pallet' | 'rack_shelf' | 'rack';
                    updateElement(selected.id, applyRackTemplate(selected, t));
                  }}
                >
                  <option value="rack_pallet">2-paletowy (5×3 kom.)</option>
                  <option value="rack_shelf">4-półkowy mały (2×4 kom.)</option>
                  <option value="rack">Standard — własny rozmiar</option>
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              {(['x', 'y', 'w', 'h'] as const).map((key) => (
                <label key={key} className="block text-xs text-slate-500">
                  {key === 'x' ? 'Kolumna' : key === 'y' ? 'Wiersz' : key === 'w' ? 'Szer.' : 'Wys.'}
                  <input
                    type="number"
                    min={key === 'w' || key === 'h' ? 1 : 0}
                    className="input-field mt-1 w-full tabular-nums py-1.5 text-sm"
                    value={selected[key]}
                    onChange={(e) => {
                      const n = Math.max(0, Number(e.target.value) || 0);
                      const patched = clampLayoutElement(
                        { ...selected, [key]: n },
                        layout.cols,
                        layout.rows,
                      );
                      updateElement(selected.id, patched);
                    }}
                  />
                </label>
              ))}
            </div>
            <p className="text-[11px] tabular-nums text-slate-500">
              Metraż elementu:{' '}
              <span className="font-medium text-slate-950 dark:text-slate-300">
                {formatElementFootprintMeters(selected.w, selected.h, metersPerCell)}
              </span>
              <span className="text-slate-600">
                {' '}
                ({selected.w}×{selected.h} kom.)
              </span>
            </p>

            {hasLocationFields(selected.type) && (
              <>
                <label className="block text-xs text-slate-500">
                  Strefa (kod)
                  <input
                    className="input-field mt-1 w-full py-1.5 font-mono text-sm"
                    value={selected.zone ?? ''}
                    onChange={(e) => updateElement(selected.id, { zone: e.target.value || undefined })}
                    placeholder="DRO"
                  />
                </label>
                {isRackElementType(selected.type) && (
                  <>
                    <label className="block text-xs text-slate-500">
                      Alejka
                      <input
                        className="input-field mt-1 w-full py-1.5 font-mono text-sm"
                        value={selected.aisle ?? ''}
                        onChange={(e) => updateElement(selected.id, { aisle: e.target.value || undefined })}
                        placeholder="A03"
                      />
                    </label>
                    <label className="block text-xs text-slate-500">
                      Regał
                      <input
                        className="input-field mt-1 w-full py-1.5 font-mono text-sm"
                        value={selected.rack ?? ''}
                        onChange={(e) => updateElement(selected.id, { rack: e.target.value || undefined })}
                        placeholder="R2"
                      />
                    </label>
                  </>
                )}
              </>
            )}
            {isRackElementType(selected.type) && (
              <p className="rounded-lg border border-brand-500/25 bg-brand-50 px-2 py-1.5 font-mono text-[11px] text-brand-800 dark:border-transparent dark:bg-slate-950/60 dark:text-brand-300">
                Kod: {formatElementLocation(selected)}
              </p>
            )}
            <label className="block text-xs text-slate-500">
              Kolor
              <input
                type="color"
                className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-slate-700 bg-transparent"
                value={selected.color ?? elementDef(selected.type).color}
                onChange={(e) => updateElement(selected.id, { color: e.target.value })}
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => duplicateElement(selected)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Copy className="h-3.5 w-3.5" />
                Kopiuj
              </button>
              <button
                type="button"
                onClick={() => deleteElement(selected.id)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-500/30 py-2 text-xs text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Usuń
              </button>
            </div>
          </div>
          </div>
        : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-500 dark:shadow-none">
            Wybierz regał, aby otworzyć konfigurator półek i sekcji towaru — lub inny element do edycji na planie.
          </div>
        }
      </aside>
    </div>
  );
}
