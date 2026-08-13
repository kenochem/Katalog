import { useMemo } from 'react';
import type { WarehouseLocation } from '../../types';
import {
  LOCATION_LEVEL_LABELS,
  formatLocationCode,
  parseLocationCode,
} from '../../lib/warehouseLocation';
import { listLocationPresetsFromLayout } from '../../lib/warehouseLayoutStore';

interface WarehouseLocationFieldsProps {
  value: WarehouseLocation;
  onChange: (next: WarehouseLocation) => void;
  /** Pełny kod DRO-A-R1-P04 */
  onApplyQuickCode?: (code: string) => void;
  layoutRevision?: number;
  compact?: boolean;
}

export function WarehouseLocationFields({
  value,
  onChange,
  onApplyQuickCode,
  layoutRevision = 0,
  compact = false,
}: WarehouseLocationFieldsProps) {
  const presets = useMemo(
    () => listLocationPresetsFromLayout(),
    // layoutRevision — odświeżenie po edycji planu
    [layoutRevision],
  );

  function updateDraft(key: keyof WarehouseLocation, v: string) {
    onChange({ ...value, [key]: v.trim() || undefined });
  }

  function applyPreset(loc: WarehouseLocation) {
    onChange({
      ...loc,
      bin: value.bin || loc.bin,
    });
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {presets.length > 0 && (
        <label className="block text-xs text-slate-600 dark:text-slate-500">
          Z planu magazynu
          <select
            className="input-field mt-1 w-full text-sm"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const preset = presets.find((p) => p.id === id);
              if (preset) applyPreset(preset.location);
              e.target.selectedIndex = 0;
            }}
          >
            <option value="">— wybierz regał / strefę —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.code})
              </option>
            ))}
          </select>
        </label>
      )}

      {onApplyQuickCode && (
        <label className="block text-xs text-slate-600 dark:text-slate-500">
          Szybki kod
          <input
            className="input-field mt-1 w-full font-mono text-sm"
            placeholder="DRO-A-R1-P04-B12"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onApplyQuickCode((e.target as HTMLInputElement).value);
              }
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) onApplyQuickCode(e.target.value);
            }}
          />
        </label>
      )}

      {LOCATION_LEVEL_LABELS.map(({ key, label, hint }) => (
        <label key={key} className="block text-xs text-slate-600 dark:text-slate-500">
          {label}
          <input
            value={value[key] ?? ''}
            onChange={(e) => updateDraft(key, e.target.value)}
            placeholder={hint}
            className="input-field mt-1 w-full font-mono text-sm uppercase"
          />
        </label>
      ))}

      <p className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 font-mono text-sm text-emerald-900 dark:border-transparent dark:bg-slate-950/80 dark:text-emerald-300">
        {formatLocationCode(value) || '— uzupełnij segmenty —'}
      </p>
    </div>
  );
}

export function parseLocationFromText(code: string): WarehouseLocation {
  return parseLocationCode(code);
}
