import type {
  SonaxAcquisitionClient,
  SonaxAcquisitionInvoice,
  SonaxAcquisitionReport,
  SonaxOverlapExcludedReport,
} from './sonaxReconcile';

export type SonaxViewMode = 'strict' | 'with_overlap' | 'custom';

const MODE_KEY = 'sonax-view-mode';
const CUSTOM_KEYS_KEY = 'sonax-custom-included-keys';

export function loadSonaxViewMode(): SonaxViewMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'with_overlap' || v === 'custom') return v;
  } catch {
    /* ignore */
  }
  return 'strict';
}

export function saveSonaxViewMode(mode: SonaxViewMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function loadSonaxCustomKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(CUSTOM_KEYS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === 'string'));
  } catch {
    return new Set();
  }
}

export function saveSonaxCustomKeys(keys: Set<string>): void {
  try {
    localStorage.setItem(CUSTOM_KEYS_KEY, JSON.stringify([...keys]));
  } catch {
    /* ignore */
  }
}

export interface SonaxComputedView {
  mode: SonaxViewMode;
  clients: SonaxAcquisitionClient[];
  invoices: SonaxAcquisitionInvoice[];
  monthlyWapro: { month: string; netPln: number }[];
  includedKeys: Set<string>;
  summary: {
    clientCount: number;
    clientsWithNip: number;
    invoiceCount: number;
    netPln: number;
    grossPln: number;
    avgNetPerClient: number;
    totalWaproNetPln: number;
    shareOfWaproPct: number;
    addedOverlapClients: number;
    addedOverlapNetPln: number;
  };
}

function monthlyFromInvoices(invoices: SonaxAcquisitionInvoice[]): { month: string; netPln: number }[] {
  const byMonth = new Map<string, number>();
  for (const inv of invoices) {
    const m = inv.date.slice(0, 7);
    if (m < '2026-03') continue;
    byMonth.set(m, (byMonth.get(m) ?? 0) + inv.netPln);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, netPln]) => ({ month, netPln: Math.round(netPln * 100) / 100 }));
}

export function computeSonaxView(
  acq: SonaxAcquisitionReport,
  excluded: SonaxOverlapExcludedReport | null,
  mode: SonaxViewMode,
  customIncludedKeys: Set<string>,
): SonaxComputedView {
  const overlapClients = excluded?.clients ?? [];
  const overlapInvoices = excluded?.invoices ?? [];

  let extraClients: SonaxAcquisitionClient[] = [];
  if (mode === 'with_overlap') {
    extraClients = overlapClients;
  } else if (mode === 'custom') {
    extraClients = overlapClients.filter((c) => customIncludedKeys.has(c.clientKey));
  }

  const extraKeys = new Set(extraClients.map((c) => c.clientKey));
  const clients = [...acq.clients, ...extraClients];
  const invoices = [
    ...acq.invoices,
    ...overlapInvoices.filter((i) => extraKeys.has(i.clientKey)),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));

  const netPln = invoices.reduce((s, i) => s + i.netPln, 0);
  const grossPln = clients.reduce((s, c) => s + c.waproGrossPln, 0);
  const totalWaproNetPln = acq.summary.totalWaproNetPln;
  const addedOverlapNetPln = extraClients.reduce((s, c) => s + c.waproNetPln, 0);

  const includedKeys = new Set([
    ...acq.clients.map((c) => c.clientKey),
    ...extraKeys,
  ]);

  return {
    mode,
    clients,
    invoices,
    monthlyWapro: monthlyFromInvoices(invoices),
    includedKeys,
    summary: {
      clientCount: clients.length,
      clientsWithNip: clients.filter((c) => c.nip).length,
      invoiceCount: invoices.length,
      netPln: Math.round(netPln * 100) / 100,
      grossPln: Math.round(grossPln * 100) / 100,
      avgNetPerClient:
        clients.length > 0 ? Math.round((netPln / clients.length) * 100) / 100 : 0,
      totalWaproNetPln,
      shareOfWaproPct:
        totalWaproNetPln > 0
          ? Math.round((1000 * netPln) / totalWaproNetPln) / 10
          : 0,
      addedOverlapClients: extraClients.length,
      addedOverlapNetPln: Math.round(addedOverlapNetPln * 100) / 100,
    },
  };
}

export function sonaxViewModeLabel(mode: SonaxViewMode): string {
  switch (mode) {
    case 'strict':
      return 'Standard (tylko czysty Sonax)';
    case 'with_overlap':
      return 'Z klientami mieszanymi';
    case 'custom':
      return 'Własny wybór';
  }
}
