import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle2,
  GripVertical,
  Phone,
  Plus,
  Send,
  Settings2,
  Trophy,
  UserPlus,
  XCircle,
  Calendar,
  Mail,
  FileText,
} from 'lucide-react';
import type { CrmClient } from '../../lib/crm';
import { formatPricePln } from '../../lib/format';
import {
  ACTIVE_STAGES,
  ACTIVITY_LABELS,
  addActivity,
  closeLeadLost,
  closeLeadWon,
  createLead,
  getClosedLeads,
  getOpenLeads,
  applyBoardLayout,
  getBoardLayout,
  loadLeads,
  loadPipelineConfig,
  moveLeadStage,
  savePipelineConfig,
  stageLabel,
  type LeadActivityType,
  type SalesLead,
} from '../../lib/leadsStore';

type ActiveLeadStage = 'new' | 'contact' | 'offer' | 'negotiation';

const STAGE_ACCENT: Record<ActiveLeadStage, string> = {
  new: 'border-t-sky-500',
  contact: 'border-t-violet-500',
  offer: 'border-t-amber-500',
  negotiation: 'border-t-emerald-500',
};

const STAGE_BG: Record<ActiveLeadStage, string> = {
  new: 'bg-sky-500/10',
  contact: 'bg-violet-500/10',
  offer: 'bg-amber-500/10',
  negotiation: 'bg-emerald-500/10',
};

interface CrmPipelinePanelProps {
  clients: CrmClient[];
  onOpenOrder?: () => void;
}

export function CrmPipelinePanel({ clients, onOpenOrder }: CrmPipelinePanelProps) {
  const [config, setConfig] = useState(() => loadPipelineConfig());
  const [leads, setLeads] = useState<SalesLead[]>(() => loadLeads());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [activityType, setActivityType] = useState<LeadActivityType>('note');
  const [activityBody, setActivityBody] = useState('');
  const [loseReason, setLoseReason] = useState('');

  useEffect(() => {
    const refresh = () => setLeads(loadLeads());
    window.addEventListener('katalog-leads-changed', refresh);
    return () => window.removeEventListener('katalog-leads-changed', refresh);
  }, []);

  const openLeads = useMemo(() => getOpenLeads(), [leads]);
  const closedLeads = useMemo(() => getClosedLeads(), [leads]);
  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const columns = ACTIVE_STAGES.map((stage) => ({
    stage,
    label: stageLabel(stage, config),
    items: openLeads.filter((l) => l.stage === stage),
  }));

  const pipelineTotal = openLeads.reduce((s, l) => s + (l.valueEstimate ?? 0), 0);
  const wonTotal = closedLeads.filter((l) => l.stage === 'won').reduce((s, l) => s + (l.valueEstimate ?? 0), 0);

  function refresh() {
    setLeads(loadLeads());
  }

  function handleMove(leadId: string, stage: typeof ACTIVE_STAGES[number]) {
    moveLeadStage(leadId, stage);
    refresh();
  }

  const [draggingLead, setDraggingLead] = useState<SalesLead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const lead = openLeads.find((l) => l.id === event.active.id);
    setDraggingLead(lead ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingLead(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const layout = getBoardLayout();

    const findStage = (id: string): ActiveLeadStage | null => {
      if (ACTIVE_STAGES.includes(id as ActiveLeadStage)) return id as ActiveLeadStage;
      const lead = leadById.get(id);
      return lead && ACTIVE_STAGES.includes(lead.stage as ActiveLeadStage)
        ? (lead.stage as ActiveLeadStage)
        : null;
    };

    const activeStage = findStage(activeId);
    const overStage = findStage(overId);
    if (!activeStage || !overStage) return;

    const activeIndex = layout[activeStage].indexOf(activeId);
    if (activeIndex === -1) return;

    let overIndex = ACTIVE_STAGES.includes(overId as ActiveLeadStage)
      ? layout[overStage].length
      : layout[overStage].indexOf(overId);
    if (overIndex === -1) overIndex = layout[overStage].length;

    if (activeStage === overStage) {
      if (activeIndex === overIndex) return;
      layout[activeStage] = arrayMove(layout[activeStage], activeIndex, overIndex);
    } else {
      layout[activeStage] = layout[activeStage].filter((id) => id !== activeId);
      const target = [...layout[overStage]];
      target.splice(overIndex, 0, activeId);
      layout[overStage] = target;
    }

    applyBoardLayout(layout);
    refresh();
  }

  function handleDragCancel() {
    setDraggingLead(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{config.name}</h2>
          <p className="text-sm text-slate-500">
            Przeciągnij karty między kolumnami i zmieniaj kolejność w kolumnie · {openLeads.length} otwartych
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowRename(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Nazwa lejka
          </button>
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
          >
            {showClosed ? 'Ukryj archiwum' : `Archiwum (${closedLeads.length})`}
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Nowy lead
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Wartość lejka</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-brand-300">{formatPricePln(pipelineTotal)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Otwarte szanse</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-100">{openLeads.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Wygrane (archiwum)</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-400">{formatPricePln(wonTotal)}</p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="crm-pipeline-board flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {columns.map((col) => {
            const colValue = col.items.reduce((s, l) => s + (l.valueEstimate ?? 0), 0);
            return (
              <PipelineColumn
                key={col.stage}
                stage={col.stage as ActiveLeadStage}
                label={col.label}
                count={col.items.length}
                value={colValue}
                isDropTarget={draggingLead != null}
                itemIds={col.items.map((l) => l.id)}
              >
                {col.items.length === 0 ? (
                  <li className="crm-pipeline-empty rounded-xl border border-dashed border-slate-800 px-3 py-6 text-center text-[11px] text-slate-600">
                    {draggingLead ? 'Upuść lead tutaj' : 'Brak leadów'}
                  </li>
                ) : (
                  col.items.map((lead) => (
                    <PipelineLeadCard
                      key={lead.id}
                      lead={lead}
                      selected={selectedId === lead.id}
                      onSelect={() => setSelectedId(lead.id)}
                      dimmed={draggingLead?.id === lead.id}
                    />
                  ))
                )}
              </PipelineColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {draggingLead ? (
            <LeadCardPreview lead={draggingLead} elevated />
          ) : null}
        </DragOverlay>
      </DndContext>

      {showClosed && closedLeads.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
          <h3 className="text-sm font-semibold text-slate-300">Zamknięte szanse</h3>
          <ul className="mt-2 space-y-1">
            {closedLeads.slice(0, 10).map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(l.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-800"
                >
                  {l.stage === 'won' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  )}
                  <span className="truncate text-slate-200">{l.title}</span>
                  <span className="ml-auto text-xs text-slate-500">{l.companyName}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-brand-400">{stageLabel(selected.stage, config)} · {selected.source}</p>
              <h3 className="text-lg font-semibold text-slate-50">{selected.title}</h3>
              <p className="text-sm text-slate-400">
                {selected.companyName}
                {selected.contactName ? ` · ${selected.contactName}` : ''}
              </p>
              {selected.phone && <p className="text-xs text-slate-500">{selected.phone}</p>}
            </div>
            {ACTIVE_STAGES.includes(selected.stage) && (
              <div className="flex flex-wrap gap-2">
                {ACTIVE_STAGES.filter((s) => s !== selected.stage).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleMove(selected.id, s)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300"
                  >
                    <GripVertical className="h-3 w-3" />
                    {stageLabel(s, config)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    closeLeadWon(selected.id);
                    refresh();
                    onOpenOrder?.();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Dopnij sprzedaż
                </button>
              </div>
            )}
          </div>

          {ACTIVE_STAGES.includes(selected.stage) && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={loseReason}
                onChange={(e) => setLoseReason(e.target.value)}
                placeholder="Powód porażki (wymagany)…"
                className="input-field min-w-[200px] flex-1 text-sm"
              />
              <button
                type="button"
                disabled={!loseReason.trim()}
                onClick={() => {
                  closeLeadLost(selected.id, loseReason);
                  setLoseReason('');
                  refresh();
                }}
                className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-300 disabled:opacity-40"
              >
                Oznacz porażkę
              </button>
            </div>
          )}

          <div className="mt-4 border-t border-slate-800 pt-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Aktywności</p>
            {ACTIVE_STAGES.includes(selected.stage) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ['note', FileText],
                    ['call', Phone],
                    ['meeting', Calendar],
                    ['offer_sent', Send],
                    ['email', Mail],
                  ] as const
                ).map(([type, Icon]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActivityType(type)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                      activityType === type ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {ACTIVITY_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
            {ACTIVE_STAGES.includes(selected.stage) && (
              <div className="mt-2 flex gap-2">
                <textarea
                  value={activityBody}
                  onChange={(e) => setActivityBody(e.target.value)}
                  rows={2}
                  placeholder="Notatka z rozmowy, spotkania lub wysyłki oferty…"
                  className="input-field flex-1 text-sm"
                />
                <button
                  type="button"
                  disabled={!activityBody.trim()}
                  onClick={() => {
                    addActivity(selected.id, activityType, activityBody);
                    setActivityBody('');
                    refresh();
                  }}
                  className="shrink-0 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Dodaj
                </button>
              </div>
            )}
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {selected.activities.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
                  <p className="text-[10px] text-slate-500">
                    {ACTIVITY_LABELS[a.type]} · {new Date(a.createdAt).toLocaleString('pl-PL')}
                  </p>
                  <p className="mt-0.5 text-slate-300">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showNew && (
        <NewLeadModal
          clients={clients}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            refresh();
            setSelectedId(id);
            setShowNew(false);
          }}
        />
      )}

      {showRename && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Zamknij" onClick={() => setShowRename(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="font-semibold text-slate-100">Nazwa lejka</h3>
            <input
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              className="input-field mt-3 w-full"
              placeholder="np. Lejek sprzedaży, Pipeline B2B…"
            />
            <button
              type="button"
              onClick={() => {
                savePipelineConfig(config);
                setShowRename(false);
              }}
              className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white"
            >
              Zapisz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineColumn({
  stage,
  label,
  count,
  value,
  isDropTarget,
  itemIds,
  children,
}: {
  stage: ActiveLeadStage;
  label: string;
  count: number;
  value: number;
  isDropTarget: boolean;
  itemIds: string[];
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`crm-pipeline-column min-w-[240px] flex-1 rounded-2xl border border-slate-800 border-t-[3px] ${STAGE_ACCENT[stage]} bg-slate-900/40 p-2 transition-colors ${
        isOver ? 'crm-pipeline-column--over ring-2 ring-brand-500/35 bg-brand-500/5' : ''
      } ${isDropTarget && !isOver ? 'crm-pipeline-column--target' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</p>
          {value > 0 && (
            <p className="text-[10px] tabular-nums text-slate-500">{formatPricePln(value)}</p>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums font-semibold ${STAGE_BG[stage]} text-slate-300`}
        >
          {count}
        </span>
      </div>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ul className="crm-pipeline-cards min-h-[5rem] space-y-2">{children}</ul>
      </SortableContext>
    </div>
  );
}

function PipelineLeadCard({
  lead,
  selected,
  onSelect,
  dimmed,
}: {
  lead: SalesLead;
  selected: boolean;
  onSelect: () => void;
  dimmed?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { stage: lead.stage },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: dimmed || isDragging ? 0.35 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="touch-manipulation"
      {...listeners}
      {...attributes}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`crm-pipeline-card group w-full cursor-grab rounded-xl border px-3 py-2.5 text-left transition active:cursor-grabbing ${
          selected
            ? 'border-brand-500/50 bg-brand-500/10 shadow-sm'
            : 'border-slate-800 bg-slate-950/60 hover:border-slate-600 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 opacity-60 sm:opacity-40 sm:group-hover:opacity-100" aria-hidden />
          <div className="min-w-0 flex-1">
            <LeadCardPreview lead={lead} />
          </div>
        </div>
      </div>
    </li>
  );
}

function LeadCardPreview({ lead, elevated = false }: { lead: SalesLead; elevated?: boolean }) {
  return (
    <div className={elevated ? 'crm-pipeline-card-ghost rounded-xl border border-brand-500/40 bg-slate-900 px-3 py-2.5 shadow-2xl shadow-black/40' : ''}>
      <p className="line-clamp-2 text-sm font-medium text-slate-100">{lead.title}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{lead.companyName}</p>
      {lead.valueEstimate > 0 && (
        <p className="mt-1.5 inline-block rounded-md bg-slate-800/80 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-brand-300">
          {formatPricePln(lead.valueEstimate)}
        </p>
      )}
    </div>
  );
}

function NewLeadModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: CrmClient[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [value, setValue] = useState('');
  const [clientId, setClientId] = useState('');

  function submit() {
    if (!title.trim() || !company.trim()) return;
    const lead = createLead({
      title,
      companyName: company,
      contactName: contact || undefined,
      phone: phone || undefined,
      clientId: clientId || undefined,
      valueEstimate: Number(value) || 0,
    });
    onCreated(lead.id);
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Zamknij" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 sm:rounded-2xl">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <UserPlus className="h-5 w-5 text-brand-400" />
          Nowy lead
        </h3>
        <div className="mt-4 space-y-3">
          <Field label="Temat / okazja" value={title} onChange={setTitle} required />
          <Field label="Firma" value={company} onChange={setCompany} required />
          <Field label="Osoba kontaktowa" value={contact} onChange={setContact} />
          <Field label="Telefon" value={phone} onChange={setPhone} />
          <Field label="Szacowana wartość (PLN netto)" value={value} onChange={setValue} type="number" />
          <label className="block text-xs text-slate-500">
            Powiąż z klientem
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const c = clients.find((x) => x.id === e.target.value);
                if (c && !company) setCompany(c.displayName);
              }}
              className="input-field mt-1 w-full"
            >
              <option value="">— nowy prospekt —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={submit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Dodaj do lejka
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="input-field mt-1 w-full"
      />
    </label>
  );
}
