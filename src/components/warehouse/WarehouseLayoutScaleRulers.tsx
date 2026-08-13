import type { ReactNode } from 'react';
import {
  formatMeters,
  rulerStepMeters,
  rulerTicksAlongMeters,
} from '../../lib/warehouseLayoutMetrics';

const RULER_GUTTER = 36;

interface WarehouseLayoutScaleRulersProps {
  cols: number;
  rows: number;
  cellPx: number;
  metersPerCell: number;
  children: ReactNode;
}

export function WarehouseLayoutScaleRulers({
  cols,
  rows,
  cellPx,
  metersPerCell,
  children,
}: WarehouseLayoutScaleRulersProps) {
  const widthPx = cols * cellPx;
  const heightPx = rows * cellPx;
  const hallWidthM = cols * metersPerCell;
  const hallHeightM = rows * metersPerCell;
  const stepM = rulerStepMeters(metersPerCell, cellPx);
  const xTicks = rulerTicksAlongMeters(hallWidthM, stepM);
  const yTicks = rulerTicksAlongMeters(hallHeightM, stepM);

  return (
    <div className="wh-layout-scale-wrap inline-block min-w-0">
      <div className="flex" style={{ paddingLeft: RULER_GUTTER }}>
        <div
          className="wh-layout-ruler wh-layout-ruler--x relative shrink-0 border-b border-slate-700/80"
          style={{ width: widthPx, height: RULER_GUTTER - 4 }}
        >
          {xTicks.map((m) => (
            <span
              key={`x-${m}`}
              className="wh-layout-ruler-tick wh-layout-ruler-tick--x"
              style={{ left: (m / metersPerCell) * cellPx }}
            >
              {formatMeters(m)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex min-w-0">
        <div
          className="wh-layout-ruler wh-layout-ruler--y relative shrink-0 border-r border-slate-700/80"
          style={{ width: RULER_GUTTER, height: heightPx }}
        >
          {yTicks.map((m) => (
            <span
              key={`y-${m}`}
              className="wh-layout-ruler-tick wh-layout-ruler-tick--y"
              style={{ top: (m / metersPerCell) * cellPx }}
            >
              {formatMeters(m)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
