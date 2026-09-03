import { supabase } from './supabase';

const PIPELINE_KEY = 'katalog-pipeline-config';
const CHANGED_EVENT = 'katalog-leads-changed';

export type LeadStage = 'new' | 'contact' | 'offer' | 'negotiation' | 'won' | 'lost';

export type LeadActivityType = 'note' | 'call' | 'meeting' | 'offer_sent' | 'email';

export interface LeadActivity {
  id: string;
  type: LeadActivityType;
  body: string;
  createdAt: string;
}

export interface SalesLead {
  id: string;
  title: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  clientId?: string;
  stage: LeadStage;
  valueEstimate: number;
  sortOrder?: number;
  source?: string;
  /** Handlowiec przypisany do leada (nazwa widoczna na karcie). */
  ownerName?: string;
  activities: LeadActivity[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closeReason?: string;
}

export interface PipelineStageDef {
  id: LeadStage;
  label: string;
}

export interface PipelineConfig {
  name: string;
  stages: PipelineStageDef[];
}

export const ACTIVE_STAGES: LeadStage[] = ['new', 'contact', 'offer', 'negotiation'];
export const TERMINAL_STAGES: LeadStage[] = ['won', 'lost'];

export const ACTIVITY_LABELS: Record<LeadActivityType, string> = {
  note: 'Notatka',
  call: 'Rozmowa tel.',
  meeting: 'Spotkanie',
  offer_sent: 'Wysłano ofertę',
  email: 'E-mail',
};

const DEFAULT_PIPELINE: PipelineConfig = {
  name: 'Lejek sprzedaży',
  stages: [
    { id: 'new', label: 'Nowy lead' },
    { id: 'contact', label: 'Kontakt' },
    { id: 'offer', label: 'Oferta' },
    { id: 'negotiation', label: 'Negocjacje' },
    { id: 'won', label: 'Wygrana' },
    { id: 'lost', label: 'Przegrana' },
  ],
};

// Etykiety etapow leja to tylko kosmetyka (nazwy kolumn) — zostaja w localStorage,
// bez ryzyka utraty danych przy zmianie urzadzenia. Same leady (SalesLead[]) sa
// w Supabase (tabela crm_leads), prywatne per handlowiec — patrz cache ponizej.
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadPipelineConfig(): PipelineConfig {
  return readJson(PIPELINE_KEY, DEFAULT_PIPELINE);
}

export function savePipelineConfig(config: PipelineConfig) {
  writeJson(PIPELINE_KEY, config);
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/**
 * Leady w pamieci (Supabase = zrodlo prawdy). loadLeads() zostaje synchroniczny —
 * uzywany w wielu miejscach jak zwykla funkcja — a odswiezanie z bazy dzieje sie
 * w tle i po zakonczeniu odpala CHANGED_EVENT (komponenty juz na niego nasluchuja).
 */
let cache: SalesLead[] = [];
let cacheReady = false;
let inFlight: Promise<void> | null = null;

function mapRow(row: Record<string, unknown>): SalesLead {
  return {
    id: String(row.id),
    title: String(row.title || ''),
    companyName: String(row.company_name || ''),
    contactName: row.contact_name ? String(row.contact_name) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    email: row.email ? String(row.email) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    stage: (row.stage as LeadStage) || 'new',
    valueEstimate: Number(row.value_estimate) || 0,
    sortOrder: Number(row.sort_order) || 0,
    source: row.source ? String(row.source) : undefined,
    ownerName: row.owner_name ? String(row.owner_name) : undefined,
    activities: Array.isArray(row.activities) ? (row.activities as LeadActivity[]) : [],
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
    closeReason: row.close_reason ? String(row.close_reason) : undefined,
  };
}

async function refreshCache(): Promise<void> {
  if (!supabase) {
    cacheReady = true;
    return;
  }
  const { data, error } = await supabase
    .from('crm_leads')
    .select('*')
    .order('sort_order', { ascending: true });
  if (!error && data) {
    cache = data.map((r) => mapRow(r as Record<string, unknown>));
  }
  cacheReady = true;
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

export function ensureLeadsLoaded(): void {
  if (cacheReady || inFlight) return;
  inFlight = refreshCache().finally(() => {
    inFlight = null;
  });
}

function compareLeadOrder(a: SalesLead, b: SalesLead): number {
  const diff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (diff !== 0) return diff;
  return b.updatedAt.localeCompare(a.updatedAt);
}

function leadsInStage(leads: SalesLead[], stage: LeadStage): SalesLead[] {
  return leads.filter((l) => l.stage === stage).sort(compareLeadOrder);
}

function normalizeLeadSortOrders(leads: SalesLead[]): SalesLead[] {
  const next = leads.map((l) => ({ ...l }));
  const changed: SalesLead[] = [];
  for (const stage of ACTIVE_STAGES) {
    const inStage = leadsInStage(next, stage);
    inStage.forEach((lead, index) => {
      const expected = index * 10;
      if (lead.sortOrder !== expected) {
        const idx = next.findIndex((l) => l.id === lead.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], sortOrder: expected };
          changed.push(next[idx]);
        }
      }
    });
  }
  if (changed.length) {
    cache = next;
    void persistPatch(changed);
  }
  return next;
}

/** Zapisz tylko zmienione leady do Supabase (update po id) — bez pelnego rewrite. */
async function persistPatch(leads: SalesLead[]): Promise<void> {
  if (!supabase || !leads.length) return;
  await Promise.all(
    leads.map((l) =>
      supabase!
        .from('crm_leads')
        .update({
          title: l.title,
          company_name: l.companyName,
          contact_name: l.contactName || null,
          phone: l.phone || null,
          email: l.email || null,
          client_id: l.clientId || null,
          stage: l.stage,
          value_estimate: l.valueEstimate,
          sort_order: l.sortOrder ?? 0,
          source: l.source || null,
          owner_name: l.ownerName || null,
          activities: l.activities,
          closed_at: l.closedAt || null,
          close_reason: l.closeReason || null,
          updated_at: l.updatedAt,
        })
        .eq('id', l.id),
    ),
  );
}

async function persistInsert(lead: SalesLead, userId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('crm_leads').insert({
    id: lead.id,
    user_id: userId,
    title: lead.title,
    company_name: lead.companyName,
    contact_name: lead.contactName || null,
    phone: lead.phone || null,
    email: lead.email || null,
    client_id: lead.clientId || null,
    stage: lead.stage,
    value_estimate: lead.valueEstimate,
    sort_order: lead.sortOrder ?? 0,
    source: lead.source || null,
    owner_name: lead.ownerName || null,
    activities: lead.activities,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  });
}

export function deleteLead(id: string): void {
  cache = cache.filter((l) => l.id !== id);
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  void supabase?.from('crm_leads').delete().eq('id', id);
}

export function loadLeads(): SalesLead[] {
  ensureLeadsLoaded();
  return normalizeLeadSortOrders(cache);
}

function updateCache(leads: SalesLead[]) {
  cache = leads;
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

export function getOpenLeads(): SalesLead[] {
  return loadLeads()
    .filter((l) => ACTIVE_STAGES.includes(l.stage))
    .sort((a, b) => {
      const stageDiff = ACTIVE_STAGES.indexOf(a.stage) - ACTIVE_STAGES.indexOf(b.stage);
      if (stageDiff !== 0) return stageDiff;
      return compareLeadOrder(a, b);
    });
}

export function getBoardLayout(): Record<LeadStage, string[]> {
  const leads = loadLeads();
  const layout = {} as Record<LeadStage, string[]>;
  for (const stage of ACTIVE_STAGES) {
    layout[stage] = leadsInStage(leads, stage).map((l) => l.id);
  }
  return layout;
}

export function applyBoardLayout(layout: Record<LeadStage, string[]>): void {
  const leads = loadLeads().map((l) => ({ ...l }));
  const changed: SalesLead[] = [];
  for (const stage of ACTIVE_STAGES) {
    const ids = layout[stage] ?? [];
    ids.forEach((id, index) => {
      const idx = leads.findIndex((l) => l.id === id);
      if (idx >= 0) {
        const wasStage = leads[idx].stage;
        leads[idx] = {
          ...leads[idx],
          stage,
          sortOrder: index * 10,
          updatedAt: wasStage !== stage ? new Date().toISOString() : leads[idx].updatedAt,
        };
        changed.push(leads[idx]);
      }
    });
  }
  updateCache(leads);
  void persistPatch(changed);
}

export function getClosedLeads(): SalesLead[] {
  return loadLeads().filter((l) => TERMINAL_STAGES.includes(l.stage));
}

export function stageLabel(stage: LeadStage, config?: PipelineConfig): string {
  const cfg = config ?? loadPipelineConfig();
  return cfg.stages.find((s) => s.id === stage)?.label ?? stage;
}

export function createLead(input: {
  title: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  clientId?: string;
  valueEstimate?: number;
  source?: string;
  ownerName?: string;
}): SalesLead {
  const now = new Date().toISOString();
  const inStage = loadLeads().filter((l) => l.stage === 'new');
  const maxOrder = inStage.reduce((m, l) => Math.max(m, l.sortOrder ?? 0), -1);
  const lead: SalesLead = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    companyName: input.companyName.trim(),
    contactName: input.contactName?.trim(),
    phone: input.phone?.trim(),
    email: input.email?.trim(),
    clientId: input.clientId,
    stage: 'new',
    sortOrder: maxOrder + 10,
    valueEstimate: input.valueEstimate ?? 0,
    source: input.source?.trim() || 'Ręcznie',
    ownerName: input.ownerName?.trim() || undefined,
    activities: [
      {
        id: `act-${Date.now()}`,
        type: 'note',
        body: 'Lead utworzony w systemie.',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  updateCache([lead, ...loadLeads()]);
  void supabase?.auth.getUser().then(({ data }) => {
    if (data?.user) void persistInsert(lead, data.user.id);
  });
  return lead;
}

export function updateLead(id: string, patch: Partial<SalesLead>) {
  const now = new Date().toISOString();
  let updated: SalesLead | null = null;
  const leads = loadLeads().map((l) => {
    if (l.id !== id) return l;
    updated = { ...l, ...patch, updatedAt: now };
    return updated;
  });
  updateCache(leads);
  if (updated) void persistPatch([updated]);
}

export function moveLeadStage(id: string, stage: LeadStage) {
  if (!ACTIVE_STAGES.includes(stage)) {
    updateLead(id, { stage });
    return;
  }
  const layout = getBoardLayout();
  const fromStage = loadLeads().find((l) => l.id === id)?.stage;
  if (!fromStage || !ACTIVE_STAGES.includes(fromStage)) {
    updateLead(id, { stage });
    return;
  }
  layout[fromStage] = layout[fromStage].filter((lid) => lid !== id);
  layout[stage] = [...layout[stage], id];
  applyBoardLayout(layout);
}

export function closeLeadWon(id: string, reason?: string) {
  const now = new Date().toISOString();
  updateLead(id, {
    stage: 'won',
    closedAt: now,
    closeReason: reason?.trim() || 'Sprzedaż dopięta',
  });
  addActivity(id, 'note', `✓ Wygrana: ${reason?.trim() || 'Sprzedaż dopięta'}`);
}

export function closeLeadLost(id: string, reason: string) {
  const now = new Date().toISOString();
  updateLead(id, {
    stage: 'lost',
    closedAt: now,
    closeReason: reason.trim(),
  });
  addActivity(id, 'note', `✗ Przegrana: ${reason.trim()}`);
}

export function addActivity(leadId: string, type: LeadActivityType, body: string) {
  const leads = loadLeads();
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx < 0) return;
  const act: LeadActivity = {
    id: `act-${Date.now()}`,
    type,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [...leads];
  next[idx] = {
    ...next[idx],
    activities: [act, ...next[idx].activities],
    updatedAt: act.createdAt,
  };
  updateCache(next);
  void persistPatch([next[idx]]);
}

export function pipelineStats() {
  const leads = loadLeads();
  const open = leads.filter((l) => ACTIVE_STAGES.includes(l.stage));
  const won = leads.filter((l) => l.stage === 'won');
  const lost = leads.filter((l) => l.stage === 'lost');
  const pipelineValue = open.reduce((s, l) => s + l.valueEstimate, 0);
  const wonValue = won.reduce((s, l) => s + l.valueEstimate, 0);
  const closed = won.length + lost.length;
  const winRate = closed > 0 ? (won.length / closed) * 100 : 0;

  return {
    openCount: open.length,
    pipelineValue,
    wonCount: won.length,
    wonValue,
    lostCount: lost.length,
    winRate,
  };
}

const SEED_KEY = 'katalog-leads-seeded-v2';

/** Demo-leady tylko przy pierwszym uzyciu i tylko jesli handlowiec faktycznie
 * nie ma jeszcze zadnych leadow w bazie (nie tylko flaga w localStorage). */
export async function seedDemoLeadsIfEmpty(): Promise<void> {
  if (localStorage.getItem(SEED_KEY)) return;
  localStorage.setItem(SEED_KEY, '1');
  ensureLeadsLoaded();
  if (inFlight) await inFlight;
  if (cache.length > 0) return;

  const demos: Parameters<typeof createLead>[0][] = [
    {
      title: 'Zapytanie o wiertła HSS — partia 200 szt.',
      companyName: 'Auto-Master Sp. z o.o.',
      contactName: 'Jan Kowalski',
      phone: '+48 601 111 222',
      valueEstimate: 8400,
      source: 'Allegro',
    },
    {
      title: 'Smary litowe — umowa roczna',
      companyName: 'Serwis-Tech Wrocław',
      contactName: 'Anna Nowak',
      valueEstimate: 24500,
      source: 'Polecenie',
    },
    {
      title: 'Klucze dynamometryczne — przetarg',
      companyName: 'Bud-Met Kraków',
      contactName: 'Piotr Wiśniewski',
      valueEstimate: 15600,
      source: 'Telefon',
    },
  ];
  const created = demos.map((d) => createLead(d));
  if (created[1]) {
    moveLeadStage(created[1].id, 'contact');
    addActivity(created[1].id, 'call', 'Rozmowa wstępna — zainteresowani pakietem chemii.');
  }
  if (created[2]) {
    moveLeadStage(created[2].id, 'offer');
    addActivity(created[2].id, 'offer_sent', 'Oferta PDF wysłana mailem, termin odpowiedzi 7 dni.');
  }
}
