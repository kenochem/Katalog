export interface SonaxAcquisitionClient {
  clientKey: string;
  matchMethod: string;
  displayName: string;
  nip: string;
  waproInvoiceCount: number;
  waproNetPln: number;
  waproGrossPln: number;
  waproFirstDate: string | null;
  waproLastDate: string | null;
  segment: string;
}

export interface SonaxAcquisitionInvoice {
  date: string;
  number: string;
  clientName: string;
  displayName: string;
  nip: string;
  netPln: number;
  grossPln: number;
  clientKey: string;
}

export interface SonaxAcquisitionReport {
  periodFrom: string;
  kenochemBeforeDataMissing?: boolean;
  summary: {
    fromSonaxClients?: number;
    migratedClients: number;
    migratedClientsWithNip: number;
    waproInvoices: number;
    waproNetPln: number;
    waproGrossPln: number;
    avgNetPerClient: number;
    totalWaproNetPln: number;
    shareOfWaproPct: number;
  };
  clients: SonaxAcquisitionClient[];
  invoices: SonaxAcquisitionInvoice[];
  monthlyWapro: { month: string; netPln: number }[];
}

export interface SonaxOverlapExcludedReport {
  kenochemBeforeDataMissing?: boolean;
  summary: {
    clients: number;
    waproInvoices: number;
    waproNetPln: number;
  };
  clients: SonaxAcquisitionClient[];
  invoices: SonaxAcquisitionInvoice[];
}

export interface SonaxReconcileReport {
  generatedAt: string;
  acquisitionDate: string;
  acquisition: SonaxAcquisitionReport;
  excludedOverlap?: SonaxOverlapExcludedReport;
  segments?: { segment: string; clients: number; sonaxGrossPln: number; waproNetPln: number }[];
  summary: {
    waproDataMissing: boolean;
    kenochemBeforeDataMissing?: boolean;
    overlapExcludedClients?: number;
    overlapExcludedNetPln?: number;
    waproNetPln?: number;
  };
}

const REPORT_URL = '/data/sonax-import/sonax-reconcile.json';

let cache: SonaxReconcileReport | null = null;
let cacheAt = 0;

export async function fetchSonaxReconcileReport(
  force = false,
): Promise<SonaxReconcileReport> {
  if (!force && cache && Date.now() - cacheAt < 60_000) return cache;
  const res = await fetch(`${REPORT_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Brak raportu Sonax (${res.status})`);
  const data = (await res.json()) as SonaxReconcileReport;
  cache = data;
  cacheAt = Date.now();
  return data;
}

export function filterAcquisitionClients(
  clients: SonaxAcquisitionClient[],
  query: string,
): SonaxAcquisitionClient[] {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  if (!q) return clients;
  return clients.filter(
    (c) =>
      c.displayName.toLowerCase().includes(q) ||
      (digits.length >= 3 && c.nip.includes(digits)),
  );
}

export function filterAcquisitionInvoices(
  invoices: SonaxAcquisitionInvoice[],
  query: string,
  clientKey?: string,
): SonaxAcquisitionInvoice[] {
  let rows = invoices;
  if (clientKey) rows = rows.filter((i) => i.clientKey === clientKey);
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  if (!q) return rows;
  return rows.filter(
    (i) =>
      i.displayName.toLowerCase().includes(q) ||
      i.number.toLowerCase().includes(q) ||
      (digits.length >= 3 && i.nip.includes(digits)),
  );
}
