import { useMemo } from 'react';
import type { WarehouseLocation } from '../../types';
import { ensureRackSections } from '../../lib/rackSections';
import {
  elementDef,
  formatElementLocation,
  isRackElementType,
  layoutCellCssType,
  loadWarehouseLayout,
  resolveLocationLayoutHighlight,
  type WarehouseLayoutMap,
} from '../../lib/warehouseLayoutStore';
import { formatFootprintMeters, resolveMetersPerCell } from '../../lib/warehouseLayoutMetrics';
import { RackSectionsCanvasOverlay } from './WarehouseRackConfigurator';

const MINI_MAX_W = 300;
const MINI_MAX_H = 280;
const MINI_CELL_PX_MIN = 4;
const MINI_CELL_PX_MAX = 18;

interface WarehouseLayoutMiniPreviewProps {
  location: WarehouseLocation;
  layoutRevision?: number;
  layout?: WarehouseLayoutMap;
  className?: string;
}

export function WarehouseLayoutMiniPreview({
  location,
  layoutRevision = 0,
  layout: layoutProp,
  className = '',
}: WarehouseLayoutMiniPreviewProps) {
  const layout = useMemo(() => {
    void layoutRevision;
    return layoutProp ?? loadWarehouseLayout();
  }, [layoutProp, layoutRevision]);

  const highlight = useMemo(
    () => resolveLocationLayoutHighlight(location, layout),
    [location, layout],
  );

  const cellPx = useMemo(() => {
    const byW = MINI_MAX_W / layout.cols;
    const byH = MINI_MAX_H / layout.rows;
    return Math.max(MINI_CELL_PX_MIN, Math.min(MINI_CELL_PX_MAX, Math.floor(Math.min(byW, byH))));
  }, [layout.cols, layout.rows]);

  const metersPerCell = resolveMetersPerCell(layout.metersPerCell);
  const footprint = formatFootprintMeters(layout.cols, layout.rows, metersPerCell);
  const hasHighlight = Boolean(highlight);

  const highlightedEl = highlight ?
    layout.elements.find((e) => e.id === highlight.elementId)
  : null;

  return (
    <div
      className={`wh-layout-mini-preview flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-none ${className}`}
    >
      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <p className="text-xs font-semibold text-slate-950 dark:text-slate-200">Plan hali</p>
        <p className="text-[10px] text-slate-600 dark:text-slate-500">
          {layout.name} · {layout.cols}×{layout.rows} kom. ({footprint})
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-2">
        <div
          className="wh-layout-canvas wh-layout-canvas--grid relative shrink-0 rounded-lg"
          style={{
            width: layout.cols * cellPx,
            height: layout.rows * cellPx,
            backgroundSize: `${cellPx}px ${cellPx}px`,
          }}
        >
          {layout.elements.map((el) => {
            const def = elementDef(el.type);
            const cssType = layoutCellCssType(el.type);
            const isTarget = highlight?.elementId === el.id;
            const dimOthers = hasHighlight && !isTarget;
            const rackSections = isRackElementType(el.type) ? ensureRackSections(el) : [];
            const accent = el.color ?? def.color;

            return (
              <div
                key={el.id}
                title={`${el.label} · ${formatElementLocation(el)}`}
                className={`wh-layout-cell wh-layout-cell--mini wh-layout-cell--${cssType} ${
                  isTarget ? 'wh-layout-cell--assign-target' : ''
                } ${dimOthers ? 'wh-layout-cell--assign-dim' : ''}`}
                style={{
                  left: el.x * cellPx,
                  top: el.y * cellPx,
                  width: el.w * cellPx,
                  height: el.h * cellPx,
                  backgroundColor: `${accent}${isTarget ? '44' : '22'}`,
                  borderColor: isTarget ? '#34d399' : accent,
                }}
              >
                {rackSections.length > 0 ?
                  <RackSectionsCanvasOverlay
                    sections={rackSections}
                    accent={accent}
                    highlightSectionId={isTarget ? highlight?.sectionId : undefined}
                  />
                : cellPx >= 10 ?
                  <>
                    <span className="wh-layout-cell-emoji">{def.emoji}</span>
                    {cellPx >= 14 && (
                      <span className="wh-layout-cell-label">{el.label.slice(0, 8)}</span>
                    )}
                  </>
                : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 px-3 py-2 text-[10px] leading-snug text-slate-600 dark:border-slate-800 dark:text-slate-500">
        {highlightedEl ?
          <>
            <span className="text-emerald-400">Podświetlono:</span>{' '}
            <span className="font-medium text-slate-950 dark:text-slate-300">{highlightedEl.label}</span>
            {highlight?.sectionId ?
              <span className="text-slate-600 dark:text-slate-400">
                {' '}
                · sekcja{' '}
                {ensureRackSections(highlightedEl).find((s) => s.id === highlight.sectionId)?.label ??
                  highlight.sectionId}
              </span>
            : null}
          </>
        : hasHighlight ?
          null
        : Object.values(location).some(Boolean) ?
          <span className="text-amber-500/90">Brak dopasowania na planie — sprawdź strefę / alejkę / regał.</span>
        : <span>Wybierz preset lub uzupełnij adres — regał podświetli się na planie.</span>}
      </div>
    </div>
  );
}
