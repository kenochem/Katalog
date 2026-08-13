import { useMemo, useState, type ReactNode } from 'react';
import { Box, Camera, Grid3x3, Layers3, MapPin, Minus, Pencil, Plus, RotateCcw, Tags } from 'lucide-react';
import type { Product } from '../../types';
import { formatLocationCode } from '../../lib/warehouseLocation';
import { mergeLocationIntoProducts } from '../../lib/locationStore';
import { useTheme } from '../../lib/theme';
import { ContextHelp } from '../ContextHelp';
import {
  elementDef,
  formatElementLocation,
  isRackElementType,
  loadWarehouseLayout,
  resolveLocationLayoutHighlight,
  seedKenochemWarehouseLayout,
  type LayoutElement,
  type WarehouseLayoutMap,
} from '../../lib/warehouseLayoutStore';

interface WarehouseIsometricViewProps {
  products?: Product[];
  onOpenLocations?: () => void;
  onOpenLayout?: () => void;
}

interface IsoPoint {
  x: number;
  y: number;
}

interface IsoElementShape {
  el: LayoutElement;
  color: string;
  skuCount: number;
  top: IsoPoint[];
  front: IsoPoint[];
  right: IsoPoint[];
  label: IsoPoint;
  badge: IsoPoint;
  zIndex: number;
  opacity: number;
  extruded: boolean;
}

const TILE_W = 34;
const TILE_H = 18;
const PADDING = 90;

type IsoCamera = 'iso_ne' | 'iso_se' | 'iso_sw' | 'iso_nw' | 'top';
type IsoLabelMode = 'clean' | 'all' | 'none';

const CAMERA_OPTIONS: { id: IsoCamera; label: string }[] = [
  { id: 'iso_ne', label: 'Kat NE' },
  { id: 'iso_se', label: 'Kat SE' },
  { id: 'iso_sw', label: 'Kat SW' },
  { id: 'iso_nw', label: 'Kat NW' },
  { id: 'top', label: 'Gora' },
];

const HEIGHTS: Partial<Record<LayoutElement['type'], number>> = {
  rack_pallet: 42,
  rack_shelf: 34,
  rack: 30,
  packing: 16,
  receiving: 14,
  shipping: 14,
  office: 22,
  social: 16,
  bathroom: 16,
  locker: 16,
  stairs: 26,
  wall: 24,
  door: 8,
  zone: 4,
  aisle: 0,
  cold: 10,
};

const FLAT_ELEMENT_TYPES = new Set<LayoutElement['type']>(['aisle', 'zone', 'door']);

const DARK_PALETTE = {
  bgStart: '#102033',
  bgEnd: '#020617',
  floor: '#0f172a',
  floorStroke: '#334155',
  grid: '#334155',
  label: '#f8fafc',
  subLabel: '#cbd5e1',
  labelStroke: '#020617',
};

const LIGHT_PALETTE = {
  bgStart: '#f8fafc',
  bgEnd: '#e2e8f0',
  floor: '#f1f5f9',
  floorStroke: '#94a3b8',
  grid: '#94a3b8',
  label: '#0f172a',
  subLabel: '#334155',
  labelStroke: '#ffffff',
};

export function WarehouseIsometricView({
  products = [],
  onOpenLocations,
  onOpenLayout,
}: WarehouseIsometricViewProps) {
  const { isDark } = useTheme();
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showWalls, setShowWalls] = useState(false);
  const [labelMode, setLabelMode] = useState<IsoLabelMode>('clean');
  const [camera, setCamera] = useState<IsoCamera>('iso_ne');
  const [heightScale, setHeightScale] = useState(0.9);
  const layout = useMemo(() => {
    seedKenochemWarehouseLayout();
    return loadWarehouseLayout();
  }, []);

  const productsWithLocations = useMemo(() => mergeLocationIntoProducts(products), [products]);

  const elementCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of productsWithLocations) {
      const location = product.warehouseLocation;
      if (!location || !formatLocationCode(location)) continue;
      const highlight = resolveLocationLayoutHighlight(location, layout);
      if (!highlight) continue;
      counts.set(highlight.elementId, (counts.get(highlight.elementId) ?? 0) + 1);
    }
    return counts;
  }, [layout, productsWithLocations]);

  const assignedCount = productsWithLocations.filter((p) => formatLocationCode(p.warehouseLocation)).length;
  const rackCount = layout.elements.filter((el) => isRackElementType(el.type)).length;
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const scene = useMemo(
    () => buildIsoScene(layout, elementCounts, { camera, heightScale, showWalls, zoom }),
    [camera, elementCounts, heightScale, layout, showWalls, zoom],
  );

  return (
    <div className="stock-app space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
              Lokalizacja produktu
            </p>
            <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Mapa magazynu 2.5D
              <ContextHelp id="warehouseIso" side="left" />
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Czytelny rzut izometryczny hali: regaly, alejki, przyjecie, pakowanie i wysylka. Docelowo klik w produkt
              podswietli jego regal, polke lub pojemnik.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          {onOpenLayout && (
            <button
              type="button"
              onClick={onOpenLayout}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
              Edytuj plan
            </button>
          )}
          {onOpenLocations && (
            <button
              type="button"
              onClick={onOpenLocations}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-500"
            >
              <MapPin className="h-4 w-4" />
              Przypisz lokalizacje
            </button>
          )}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <IsoMetric label="Regaly" value={rackCount} />
          <IsoMetric label="SKU z adresem" value={assignedCount} />
          <IsoMetric label="Elementy planu" value={layout.elements.length} />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{layout.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              SVG izometryczne, na bazie edytora ukladu hali.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <IsoControl active={showGrid} label="Siatka" icon={<Grid3x3 className="h-3.5 w-3.5" />} onClick={() => setShowGrid((v) => !v)} />
            <IsoControl active={showWalls} label="Sciany" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setShowWalls((v) => !v)} />
            <IsoControl
              active={labelMode !== 'none'}
              label={labelMode === 'all' ? 'Wszystkie etykiety' : labelMode === 'clean' ? 'Etykiety' : 'Bez etykiet'}
              icon={<Tags className="h-3.5 w-3.5" />}
              onClick={() => setLabelMode((mode) => (mode === 'clean' ? 'all' : mode === 'all' ? 'none' : 'clean'))}
            />
            <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <Camera className="h-3.5 w-3.5" />
              <select
                value={camera}
                onChange={(e) => setCamera(e.target.value as IsoCamera)}
                className="bg-transparent text-xs font-semibold outline-none"
                aria-label="Widok mapy"
              >
                {CAMERA_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <Layers3 className="h-3.5 w-3.5" />
              <button
                type="button"
                onClick={() => setHeightScale((v) => Math.max(0.35, round(v - 0.1)))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Zmniejsz wysokosc blokow"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-10 text-center tabular-nums">{Math.round(heightScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setHeightScale((v) => Math.min(1.8, round(v + 0.1)))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Zwieksz wysokosc blokow"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setZoom((v) => Math.max(0.78, round(v - 0.08)))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Pomniejsz"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((v) => Math.min(1.35, round(v + 0.08)))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Powieksz"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-auto bg-slate-100 p-3 dark:bg-slate-950 sm:p-5">
          <svg
            role="img"
            aria-label="Izometryczna mapa magazynu"
            className="mx-auto block min-w-[960px] rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/30 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/25"
            width={scene.width}
            height={scene.height}
            viewBox={`0 0 ${scene.width} ${scene.height}`}
          >
            <defs>
              <linearGradient id="whIsoBg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor={palette.bgStart} />
                <stop offset="100%" stopColor={palette.bgEnd} />
              </linearGradient>
              <filter id="whIsoShadow" x="-20%" y="-20%" width="150%" height="160%">
                <feDropShadow dx="0" dy="16" stdDeviation="10" floodColor="#000000" floodOpacity="0.26" />
              </filter>
            </defs>
            <rect width={scene.width} height={scene.height} fill="url(#whIsoBg)" rx="28" />
            <polygon points={pointsAttr(scene.floor)} fill={palette.floor} stroke={palette.floorStroke} strokeWidth="1.5" />
            {showGrid && scene.gridLines.map((line, index) => (
              <line
                key={index}
                x1={line[0].x}
                y1={line[0].y}
                x2={line[1].x}
                y2={line[1].y}
                stroke={palette.grid}
                strokeOpacity={isDark ? 0.28 : 0.42}
                strokeWidth="1"
              />
            ))}
            {scene.shapes.map((shape) => (
              <g key={shape.el.id} filter={shape.el.type === 'aisle' || shape.el.type === 'zone' ? undefined : 'url(#whIsoShadow)'}>
                <title>{`${shape.el.label} - ${formatElementLocation(shape.el)}`}</title>
                {shape.extruded && (
                  <>
                    <polygon points={pointsAttr(shape.front)} fill={shade(shape.color, isDark ? -34 : -18)} stroke={shade(shape.color, isDark ? -14 : -2)} strokeWidth="1" opacity={shape.opacity} />
                    <polygon points={pointsAttr(shape.right)} fill={shade(shape.color, isDark ? -22 : -8)} stroke={shade(shape.color, isDark ? -8 : 4)} strokeWidth="1" opacity={shape.opacity} />
                  </>
                )}
                <polygon
                  points={pointsAttr(shape.top)}
                  fill={shape.el.type === 'aisle' ? shade(shape.color, isDark ? 8 : 56) : shade(shape.color, isDark ? 16 : 34)}
                  stroke={shade(shape.color, isDark ? 28 : 18)}
                  strokeDasharray={shape.el.type === 'aisle' ? '6 4' : undefined}
                  strokeWidth={shape.el.type === 'aisle' ? 1.8 : 1.4}
                  opacity={shape.opacity}
                />
                {shouldShowLabel(shape.el, labelMode) && (
                  <>
                    <text
                      x={shape.label.x}
                      y={shape.label.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={palette.label}
                      fontSize={isSmallElement(shape.el) ? 8 : 10}
                      fontWeight="800"
                      paintOrder="stroke"
                      stroke={palette.labelStroke}
                      strokeWidth={isDark ? 3 : 4}
                    >
                      {shortLabel(shape.el.label, isSmallElement(shape.el) ? 10 : 16)}
                    </text>
                    {!isSmallElement(shape.el) && (
                      <text
                        x={shape.label.x}
                        y={shape.label.y + 12}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={palette.subLabel}
                        fontSize="8"
                        fontWeight="700"
                        paintOrder="stroke"
                        stroke={palette.labelStroke}
                        strokeWidth={isDark ? 2.5 : 3.5}
                      >
                        {formatElementLocation(shape.el)}
                      </text>
                    )}
                  </>
                )}
                {shape.skuCount > 0 && (
                  <g transform={`translate(${shape.badge.x} ${shape.badge.y})`}>
                    <rect x="-18" y="-10" width="36" height="20" rx="10" fill="#34d399" />
                    <Box x="-13" y="-6" width="12" height="12" color="#022c22" />
                    <text x="6" y="1" textAnchor="middle" dominantBaseline="middle" fill="#022c22" fontSize="10" fontWeight="900">
                      {shape.skuCount}
                    </text>
                  </g>
                )}
              </g>
            ))}
          </svg>
        </div>
      </section>
    </div>
  );
}

function IsoMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function IsoControl({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition ${
        active
          ? 'border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300'
          : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function buildIsoScene(
  layout: WarehouseLayoutMap,
  elementCounts: Map<string, number>,
  options: { camera: IsoCamera; heightScale: number; showWalls: boolean; zoom: number },
) {
  const tileW = TILE_W * options.zoom;
  const tileH = TILE_H * options.zoom;
  const heightScale = options.camera === 'top' ? 0 : options.zoom * options.heightScale;
  const rawFloor = [
    project(0, 0, layout, tileW, tileH, options.camera),
    project(layout.cols, 0, layout, tileW, tileH, options.camera),
    project(layout.cols, layout.rows, layout, tileW, tileH, options.camera),
    project(0, layout.rows, layout, tileW, tileH, options.camera),
  ];
  const visibleElements = layout.elements.filter((el) => options.showWalls || !['wall', 'door'].includes(el.type));
  const rawShapes: IsoElementShape[] = visibleElements
    .map((el) => {
      const def = elementDef(el.type);
      const color = el.color ?? def.color;
      const baseHeight = FLAT_ELEMENT_TYPES.has(el.type) ? 0 : (HEIGHTS[el.type] ?? 16);
      const height = baseHeight * heightScale;
      const a = project(el.x, el.y, layout, tileW, tileH, options.camera);
      const b = project(el.x + el.w, el.y, layout, tileW, tileH, options.camera);
      const c = project(el.x + el.w, el.y + el.h, layout, tileW, tileH, options.camera);
      const d = project(el.x, el.y + el.h, layout, tileW, tileH, options.camera);
      const at = lift(a, height);
      const bt = lift(b, height);
      const ct = lift(c, height);
      const dt = lift(d, height);
      const wallPriority = el.type === 'wall' ? -1000 : 0;
      const flat = height <= 0.5;
      return {
        el,
        color,
        skuCount: elementCounts.get(el.id) ?? 0,
        top: [at, bt, ct, dt],
        front: [dt, ct, c, d],
        right: [bt, ct, c, b],
        label: lift(center([at, bt, ct, dt]), isSmallElement(el) ? 2 : 5),
        badge: lift(center([bt, ct]), 12),
        zIndex: wallPriority + el.x + el.y + el.w + el.h,
        opacity: el.type === 'aisle' ? 0.5 : el.type === 'zone' ? 0.62 : el.type === 'wall' ? 0.55 : 1,
        extruded: !flat,
      };
    })
    .sort((a, b) => a.zIndex - b.zIndex);

  const allPoints = [
    ...rawFloor,
    ...rawShapes.flatMap((shape) => [...shape.top, ...shape.front, ...shape.right, shape.label, shape.badge]),
  ];
  const minX = Math.min(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const shift = (point: IsoPoint): IsoPoint => ({
    x: point.x - minX + PADDING,
    y: point.y - minY + PADDING,
  });
  const shiftedFloor = rawFloor.map(shift);
  const gridLines = buildGridLines(layout, tileW, tileH, options.camera).map(([start, end]) => [shift(start), shift(end)] as [IsoPoint, IsoPoint]);
  return {
    width: Math.max(980, Math.ceil(maxX - minX + PADDING * 2)),
    height: Math.max(620, Math.ceil(maxY - minY + PADDING * 2)),
    floor: shiftedFloor,
    gridLines,
    shapes: rawShapes.map((shape) => ({
      ...shape,
      top: shape.top.map(shift),
      front: shape.front.map(shift),
      right: shape.right.map(shift),
      label: shift(shape.label),
      badge: shift(shape.badge),
    })),
  };
}

function buildGridLines(layout: WarehouseLayoutMap, tileW: number, tileH: number, camera: IsoCamera): [IsoPoint, IsoPoint][] {
  const lines: [IsoPoint, IsoPoint][] = [];
  for (let x = 0; x <= layout.cols; x += 2) {
    lines.push([project(x, 0, layout, tileW, tileH, camera), project(x, layout.rows, layout, tileW, tileH, camera)]);
  }
  for (let y = 0; y <= layout.rows; y += 2) {
    lines.push([project(0, y, layout, tileW, tileH, camera), project(layout.cols, y, layout, tileW, tileH, camera)]);
  }
  return lines;
}

function project(
  x: number,
  y: number,
  layout: WarehouseLayoutMap,
  tileW: number,
  tileH: number,
  camera: IsoCamera,
): IsoPoint {
  const rotated = rotateGridPoint(x, y, layout, camera);
  if (camera === 'top') {
    const topCell = Math.max(18, tileW * 0.72);
    return {
      x: rotated.x * topCell,
      y: rotated.y * topCell,
    };
  }
  return {
    x: (rotated.x - rotated.y) * (tileW / 2),
    y: (rotated.x + rotated.y) * (tileH / 2),
  };
}

function rotateGridPoint(x: number, y: number, layout: WarehouseLayoutMap, camera: IsoCamera): IsoPoint {
  const cx = layout.cols / 2;
  const cy = layout.rows / 2;
  const dx = x - cx;
  const dy = y - cy;
  if (camera === 'iso_se') return { x: -dy, y: dx };
  if (camera === 'iso_sw') return { x: -dx, y: -dy };
  if (camera === 'iso_nw') return { x: dy, y: -dx };
  return { x: dx, y: dy };
}

function lift(point: IsoPoint, height: number): IsoPoint {
  return { x: point.x, y: point.y - height };
}

function center(points: IsoPoint[]): IsoPoint {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function pointsAttr(points: IsoPoint[]): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function shortLabel(label: string, max = 18): string {
  return label.length > max ? `${label.slice(0, Math.max(3, max - 2))}...` : label;
}

function isSmallElement(el: LayoutElement): boolean {
  return el.w * el.h <= 6 || ['aisle', 'door', 'bathroom', 'locker', 'social'].includes(el.type);
}

function shouldShowLabel(el: LayoutElement, mode: IsoLabelMode): boolean {
  if (mode === 'none') return false;
  if (mode === 'all') return true;
  if (['wall', 'door', 'aisle'].includes(el.type)) return false;
  return isRackElementType(el.type) || ['packing', 'receiving', 'shipping', 'zone'].includes(el.type);
}

function shade(hex: string, amount: number): string {
  const parsed = parseHex(hex);
  if (!parsed) return hex;
  const channel = (value: number) => Math.max(0, Math.min(255, value + amount));
  return `#${[channel(parsed.r), channel(parsed.g), channel(parsed.b)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}
