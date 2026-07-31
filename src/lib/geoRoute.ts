/** Geokodowanie (Nominatim) + trasy samochodowe (OSRM) — bez kluczy API. */

export interface GeoPoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface RouteLeg {
  distanceM: number;
  durationS: number;
  fromLabel: string;
  toLabel: string;
}

export interface RouteResult {
  distanceM: number;
  durationS: number;
  legs: RouteLeg[];
  /** GeoJSON LineString coordinates [lng, lat][] */
  coordinates: [number, number][];
}

const NOMINATIM =
  'https://nominatim.openstreetmap.org/search';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export async function geocodeAddress(
  query: string
): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const url = new URL(NOMINATIM);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'pl');
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Geokodowanie niedostępne');
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
  }>;
  if (!data[0]) return null;
  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    label: data[0].display_name,
  };
}

export async function buildDrivingRoute(
  points: GeoPoint[]
): Promise<RouteResult> {
  if (points.length < 2) {
    throw new Error('Dodaj co najmniej 2 punkty trasy');
  }
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Nie udało się policzyć trasy (OSRM)');
  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry?: { coordinates?: [number, number][] };
      legs?: Array<{ distance: number; duration: number }>;
    }>;
  };
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error('Brak trasy między punktami');
  }
  const route = data.routes[0];
  const legs: RouteLeg[] = (route.legs ?? []).map((leg, i) => ({
    distanceM: leg.distance,
    durationS: leg.duration,
    fromLabel: points[i]?.label || `Punkt ${i + 1}`,
    toLabel: points[i + 1]?.label || `Punkt ${i + 2}`,
  }));
  return {
    distanceM: route.distance,
    durationS: route.duration,
    legs,
    coordinates: route.geometry?.coordinates ?? [],
  };
}
