const LEADS_KEY = 'katalog-sales-leads';
const PIPELINE_KEY = 'katalog-pipeline-config';
const SEED_KEY = 'katalog-leads-seeded';

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
  window.dispatchEvent(new CustomEvent('katalog-leads-changed'));
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
  let changed = false;
  const next = leads.map((l) => ({ ...l }));
  for (const stage of ACTIVE_STAGES) {
    const inStage = leadsInStage(next, stage);
    inStage.forEach((lead, index) => {
      const expected = index * 10;
      if (lead.sortOrder !== expected) {
        const idx = next.findIndex((l) => l.id === lead.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], sortOrder: expected };
          changed = true;
        }
      }
    });
  }
  if (changed) writeJson(LEADS_KEY, next);
  return next;
}

export function loadLeads(): SalesLead[] {
  const leads = readJson<SalesLead[]>(LEADS_KEY, []);
  return normalizeLeadSortOrders(leads);
}

function saveLeads(leads: SalesLead[]) {
  writeJson(LEADS_KEY, leads);
  window.dispatchEvent(new CustomEvent('katalog-leads-changed'));
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
  for (const stage of ACTIVE_STAGES) {
    const ids = layout[stage] ?? [];
    ids.forEach((id, index) => {
      const idx = leads.findIndex((l) => l.id === id);
      if (idx >= 0) {
        leads[idx] = {
          ...leads[idx],
          stage,
          sortOrder: index * 10,
          updatedAt:
            leads[idx].stage !== stage ? new Date().toISOString() : leads[idx].updatedAt,
        };
      }
    });
  }
  saveLeads(leads);
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
}): SalesLead {
  const now = new Date().toISOString();
  const inStage = loadLeads().filter((l) => l.stage === 'new');
  const maxOrder = inStage.reduce((m, l) => Math.max(m, l.sortOrder ?? 0), -1);
  const lead: SalesLead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
  saveLeads([lead, ...loadLeads()]);
  return lead;
}

export function updateLead(id: string, patch: Partial<SalesLead>) {
  const leads = loadLeads().map((l) =>
    l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l,
  );
  saveLeads(leads);
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
  leads[idx] = {
    ...leads[idx],
    activities: [act, ...leads[idx].activities],
    updatedAt: act.createdAt,
  };
  saveLeads(leads);
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

export function seedDemoLeads() {
  if (localStorage.getItem(SEED_KEY)) return;
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
  for (const d of demos) createLead(d);
  const leads = loadLeads();
  if (leads[1]) {
    moveLeadStage(leads[1].id, 'contact');
    addActivity(leads[1].id, 'call', 'Rozmowa wstępna — zainteresowani pakietem chemii.');
  }
  if (leads[2]) {
    moveLeadStage(leads[2].id, 'offer');
    addActivity(leads[2].id, 'offer_sent', 'Oferta PDF wysłana mailem, termin odpowiedzi 7 dni.');
  }
  localStorage.setItem(SEED_KEY, '1');
}
