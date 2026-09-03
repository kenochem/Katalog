import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { CrmClient } from '../lib/crm';
import { updateCrmClientGeo } from '../lib/crm';
import {
  buildDrivingRoute,
  formatDistance,
  formatDuration,
  geocodeAddress,
  type RouteResult,
} from '../lib/geoRoute';
import { showToast } from '../lib/toast';

// Fix default marker icons in Vite bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const PL_CENTER: L.LatLngExpression = [52.1, 19.4];
const PL_ZOOM = 6;

/** Baza Kenochem — punkt wypadowy, skad zbiera sie towar i rusza w trase.
 * Gen. Wl. Andersa 40, Boks 16, 15-113 Bialystok (wspolrzedne z OpenStreetMap). */
const KENOCHEM_HQ_ID = 'kenochem-hq';
const KENOCHEM_HQ = {
  id: KENOCHEM_HQ_ID,
  displayName: 'Kenochem — baza',
  address: 'Gen. Wł. Andersa 40, Boks 16, 15-113 Białystok',
  lat: 53.155146,
  lng: 23.165327,
};

const hqIcon = L.divIcon({
  className: '',
  html: '<div style="background:#16a34a;width:1.1rem;height:1.1rem;border-radius:9999px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface RouteStop {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface CrmMapRoutesViewProps {
  clients: CrmClient[];
  cloudEnabled: boolean;
  onBack: () => void;
  onClientsChange: (clients: CrmClient[]) => void;
}

export function CrmMapRoutesView({
  clients,
  cloudEnabled,
  onBack,
  onClientsChange,
}: CrmMapRoutesViewProps) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const [pinClientId, setPinClientId] = useState<string | null>(null);
  const [routeIds, setRouteIds] = useState<string[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  const pinned = useMemo(
    () => clients.filter((c) => c.lat != null && c.lng != null),
    [clients]
  );
  const unpinned = useMemo(
    () => clients.filter((c) => c.lat == null || c.lng == null),
    [clients]
  );

  const pinClientIdRef = useRef(pinClientId);
  pinClientIdRef.current = pinClientId;
  const clientsRef = useRef(clients);
  clientsRef.current = clients;
  const onClientsChangeRef = useRef(onClientsChange);
  onClientsChangeRef.current = onClientsChange;
  const cloudRef = useRef(cloudEnabled);
  cloudRef.current = cloudEnabled;

  async function placePin(clientId: string, lat: number, lng: number) {
    if (!cloudRef.current) {
      showToast('Zaloguj się, żeby zapisać pinezkę', 'warn', 3000);
      return;
    }
    const list = clientsRef.current;
    const client = list.find((c) => c.id === clientId);
    if (!client) return;
    try {
      const updated = await updateCrmClientGeo(clientId, lat, lng);
      onClientsChangeRef.current(
        list.map((c) => (c.id === clientId ? updated : c))
      );
      setPinClientId(null);
      showToast(`Pinezka: ${client.displayName}`, 'ok', 2500);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Nie zapisano pinezki',
        'warn',
        4000
      );
    }
  }

  const placePinRef = useRef(placePin);
  placePinRef.current = placePin;

  // Init map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      center: PL_CENTER,
      zoom: PL_ZOOM,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const id = pinClientIdRef.current;
      if (!id) return;
      void placePinRef.current(id, e.latlng.lat, e.latlng.lng);
    });

    L.marker([KENOCHEM_HQ.lat, KENOCHEM_HQ.lng], { icon: hqIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(`<strong>${escapeHtml(KENOCHEM_HQ.displayName)}</strong><br/><span style="opacity:.7">${escapeHtml(KENOCHEM_HQ.address)}</span>`);

    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      routeLayerRef.current = null;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const keep = new Set(pinned.map((c) => c.id));
    for (const [id, marker] of markersRef.current) {
      if (!keep.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const c of pinned) {
      if (c.lat == null || c.lng == null) continue;
      const existing = markersRef.current.get(c.id);
      if (existing) {
        existing.setLatLng([c.lat, c.lng]);
        existing.setPopupContent(popupHtml(c));
        continue;
      }
      const m = L.marker([c.lat, c.lng], { draggable: true })
        .addTo(map)
        .bindPopup(popupHtml(c));
      m.on('dragend', () => {
        const ll = m.getLatLng();
        void placePinRef.current(c.id, ll.lat, ll.lng);
      });
      m.on('click', () => {
        setRouteIds((prev) =>
          prev.includes(c.id) ? prev : [...prev, c.id]
        );
      });
      markersRef.current.set(c.id, m);
    }

    if (pinned.length > 0 && !routeResult) {
      const bounds = L.latLngBounds(
        pinned.map((c) => [c.lat!, c.lng!] as [number, number])
      );
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }
  }, [pinned, routeResult]);

  // Draw route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    if (!routeResult?.coordinates.length) return;
    const latlngs = routeResult.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    );
    const line = L.polyline(latlngs, {
      color: '#2a9a32',
      weight: 4,
      opacity: 0.85,
    }).addTo(map);
    routeLayerRef.current = line;
    map.fitBounds(line.getBounds().pad(0.15));
  }, [routeResult]);

  async function geocodeClient(c: CrmClient) {
    if (!c.address?.trim()) {
      showToast('Brak adresu — wybierz klienta i kliknij mapę', 'info', 3500);
      setPinClientId(c.id);
      return;
    }
    setGeoBusy(true);
    try {
      const point = await geocodeAddress(c.address);
      if (!point) {
        showToast('Nie znaleziono adresu — kliknij mapę', 'warn', 3500);
        setPinClientId(c.id);
        return;
      }
      await placePin(c.id, point.lat, point.lng);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Geokodowanie nieudane',
        'warn',
        3500
      );
      setPinClientId(c.id);
    } finally {
      setGeoBusy(false);
    }
  }

  async function clearPin(clientId: string) {
    if (!cloudEnabled) return;
    try {
      const updated = await updateCrmClientGeo(clientId, null, null);
      onClientsChange(clients.map((c) => (c.id === clientId ? updated : c)));
      setRouteIds((ids) => ids.filter((id) => id !== clientId));
      setRouteResult(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Nie usunięto pinezki',
        'warn',
        3000
      );
    }
  }

  function moveStop(index: number, dir: -1 | 1) {
    setRouteIds((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setRouteResult(null);
  }

  function resolveStop(id: string): RouteStop | null {
    if (id === KENOCHEM_HQ_ID) return KENOCHEM_HQ;
    const c = clients.find((x) => x.id === id);
    if (!c || c.lat == null || c.lng == null) return null;
    return { id: c.id, displayName: c.displayName, lat: c.lat, lng: c.lng };
  }

  async function computeRoute() {
    const stops = routeIds.map(resolveStop).filter((s): s is RouteStop => Boolean(s));
    if (stops.length < 2) {
      showToast('Dodaj min. 2 przystanki z pinezkami do trasy', 'info', 3500);
      return;
    }
    setBusy(true);
    setRouteResult(null);
    try {
      const result = await buildDrivingRoute(
        stops.map((c) => ({
          lat: c.lat,
          lng: c.lng,
          label: c.displayName,
        }))
      );
      setRouteResult(result);
      showToast(
        `Trasa: ${formatDistance(result.distanceM)} · ${formatDuration(result.durationS)}`,
        'ok',
        4000
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Błąd trasy',
        'warn',
        4000
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        ← Panel CRM
      </button>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Mapa i trasy
          </h2>
          <p className="text-sm text-slate-400">
            Pinezki klientów na mapie Polski · buduj trasę z czasami jazdy
            (OSRM).
          </p>
        </div>
        {pinClientId && (
          <p className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
            <Crosshair className="h-3.5 w-3.5" />
            Kliknij mapę, żeby ustawić pinezkę
            <button
              type="button"
              className="ml-1 rounded p-0.5 hover:bg-amber-500/20"
              onClick={() => setPinClientId(null)}
              aria-label="Anuluj"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
        {/* Sidebar */}
        <div className="flex max-h-[min(70vh,560px)] flex-col gap-3 overflow-hidden lg:max-h-[min(75vh,640px)]">
          <section className="shrink-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Trasa ({routeIds.length})
            </p>
            {routeIds.length === 0 ? (
              <p className="text-xs text-slate-500">
                Kliknij pinezkę na mapie lub „+ trasa” przy kliencie.
              </p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {routeIds.map((id, i) => {
                  const stop = id === KENOCHEM_HQ_ID ? KENOCHEM_HQ : clients.find((x) => x.id === id);
                  if (!stop) return null;
                  return (
                    <li
                      key={`${id}-${i}`}
                      className="flex items-center gap-1 rounded-lg bg-slate-950/80 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <span className="w-4 tabular-nums text-slate-500">
                        {i + 1}.
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                        {id === KENOCHEM_HQ_ID && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        )}
                        {stop.displayName}
                      </span>
                      <button
                        type="button"
                        className="rounded p-0.5 text-slate-500 hover:text-slate-200"
                        onClick={() => moveStop(i, -1)}
                        aria-label="Wyżej"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 text-slate-500 hover:text-slate-200"
                        onClick={() => moveStop(i, 1)}
                        aria-label="Niżej"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 text-slate-500 hover:text-rose-400"
                        onClick={() => {
                          setRouteIds((ids) => ids.filter((_, j) => j !== i));
                          setRouteResult(null);
                        }}
                        aria-label="Usuń"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || routeIds.length < 2}
                onClick={() => void computeRoute()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5" />
                )}
                Policz trasę
              </button>
              {routeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRouteIds([]);
                    setRouteResult(null);
                  }}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Wyczyść
                </button>
              )}
            </div>
            {routeResult && (
              <div className="mt-2 space-y-1 rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100">
                <p className="font-semibold">
                  {formatDistance(routeResult.distanceM)} ·{' '}
                  {formatDuration(routeResult.durationS)}
                </p>
                {routeResult.legs.map((leg, i) => (
                  <p key={i} className="text-[11px] text-brand-800/80 dark:text-brand-200/80">
                    {i + 1}→{i + 2}: {formatDistance(leg.distanceM)} /{' '}
                    {formatDuration(leg.durationS)}
                  </p>
                ))}
              </div>
            )}
          </section>

          <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Baza
            </p>
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-2">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-white/60 bg-emerald-500 shadow" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{KENOCHEM_HQ.displayName}</p>
                <p className="truncate text-[11px] text-slate-500">{KENOCHEM_HQ.address}</p>
                <button
                  type="button"
                  onClick={() =>
                    setRouteIds((prev) =>
                      prev.includes(KENOCHEM_HQ_ID) ? prev : [KENOCHEM_HQ_ID, ...prev],
                    )
                  }
                  className="mt-1 inline-flex items-center gap-0.5 rounded-lg border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/10"
                >
                  <Plus className="h-3 w-3" /> start trasy
                </button>
              </div>
            </div>

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Klienci ({clients.length})
            </p>
            {!cloudEnabled && (
              <p className="mb-2 text-xs text-amber-300/90">
                Zaloguj się, żeby zapisywać pinezki.
              </p>
            )}
            {clients.length === 0 ? (
              <p className="text-xs text-slate-500">
                Brak klientów — dodaj ich w zakładce Klienci.
              </p>
            ) : (
              <ul className="space-y-1">
                {pinned.map((c) => (
                  <ClientRow
                    key={c.id}
                    c={c}
                    pinned
                    onPinMap={() => setPinClientId(c.id)}
                    onGeocode={() => void geocodeClient(c)}
                    onAddRoute={() =>
                      setRouteIds((prev) =>
                        prev.includes(c.id) ? prev : [...prev, c.id]
                      )
                    }
                    onClear={() => void clearPin(c.id)}
                    geoBusy={geoBusy}
                  />
                ))}
                {unpinned.map((c) => (
                  <ClientRow
                    key={c.id}
                    c={c}
                    pinned={false}
                    onPinMap={() => setPinClientId(c.id)}
                    onGeocode={() => void geocodeClient(c)}
                    onAddRoute={() =>
                      showToast('Najpierw ustaw pinezkę', 'info', 2500)
                    }
                    onClear={() => undefined}
                    geoBusy={geoBusy}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Map */}
        <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-slate-800 lg:min-h-[560px]">
          <div ref={mapEl} className="absolute inset-0 z-0 h-full w-full" />
          <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg bg-slate-950/80 px-2 py-1 text-[10px] text-slate-400 backdrop-blur">
            Polska · OpenStreetMap
          </div>
        </div>
      </div>
    </div>
  );
}

function popupHtml(c: CrmClient): string {
  const addr = c.address
    ? `<br/><span style="opacity:.7">${escapeHtml(c.address)}</span>`
    : '';
  return `<strong>${escapeHtml(c.displayName)}</strong>${addr}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ClientRow({
  c,
  pinned,
  onPinMap,
  onGeocode,
  onAddRoute,
  onClear,
  geoBusy,
}: {
  c: CrmClient;
  pinned: boolean;
  onPinMap: () => void;
  onGeocode: () => void;
  onAddRoute: () => void;
  onClear: () => void;
  geoBusy: boolean;
}) {
  return (
    <li className="flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-slate-950/70">
      <MapPin
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          pinned ? 'text-brand-400' : 'text-slate-600'
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-100">{c.displayName}</p>
        <p className="truncate text-[11px] text-slate-500">
          {c.address || (pinned ? 'Na mapie' : 'Bez adresu / pinezki')}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={onPinMap}
            className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-brand-500/50"
          >
            Klik mapę
          </button>
          <button
            type="button"
            disabled={geoBusy || !c.address}
            onClick={onGeocode}
            className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-brand-500/50 disabled:opacity-40"
          >
            Z adresu
          </button>
          {pinned && (
            <>
              <button
                type="button"
                onClick={onAddRoute}
                className="inline-flex items-center gap-0.5 rounded-lg border border-brand-500/40 px-2 py-0.5 text-[10px] text-brand-300 hover:bg-brand-500/10"
              >
                <Plus className="h-3 w-3" /> trasa
              </button>
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-500 hover:text-rose-400"
              >
                Usuń pin
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
