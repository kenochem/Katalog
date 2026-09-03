import {
  Building2,
  Car,
  Dumbbell,
  Factory,
  Store,
  User,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type ClientIconKey =
  | 'person'
  | 'company'
  | 'carwash'
  | 'gym'
  | 'workshop'
  | 'store'
  | 'warehouse'
  | 'factory';

export const CLIENT_ICON_OPTIONS: { id: ClientIconKey; label: string; Icon: LucideIcon }[] = [
  { id: 'person', label: 'Osoba / JDG', Icon: User },
  { id: 'company', label: 'Firma', Icon: Building2 },
  { id: 'carwash', label: 'Myjnia', Icon: Car },
  { id: 'gym', label: 'Siłownia', Icon: Dumbbell },
  { id: 'workshop', label: 'Warsztat', Icon: Wrench },
  { id: 'store', label: 'Sklep', Icon: Store },
  { id: 'warehouse', label: 'Hurtownia', Icon: Warehouse },
  { id: 'factory', label: 'Zakład', Icon: Factory },
];

const ICON_MAP = new Map(CLIENT_ICON_OPTIONS.map((o) => [o.id, o.Icon]));

/** Ikona typu klienta wybrana recznie w kartotece — domyslnie budynek (firma). */
export function getClientIcon(iconKey?: string | null): LucideIcon {
  return (iconKey && ICON_MAP.get(iconKey as ClientIconKey)) || Building2;
}
