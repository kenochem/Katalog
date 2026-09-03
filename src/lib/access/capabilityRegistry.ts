import type { HubModuleId } from '../../app/moduleRegistry';
import type { RoleAction } from '../roleDefinitions';

/**
 * Rejestr uprawnień Kenochem — jedno miejsce na metadane UI i mapowanie na RoleAction.
 * Nowa funkcja: dodaj RoleAction w roleDefinitions + wpis tutaj + domyślną macierz.
 */
export type CapabilityGroup =
  | 'modules'
  | 'catalog'
  | 'crm'
  | 'ops'
  | 'comms'
  | 'admin';

export type CapabilityId =
  | 'module.catalog'
  | 'module.crm'
  | 'module.ops'
  | 'module.comms'
  | 'module.calendar'
  | 'catalog.viewImages'
  | 'catalog.viewPrices'
  | 'catalog.switchCatalog'
  | 'catalog.editStock'
  | 'catalog.editProduct'
  | 'catalog.deleteProduct'
  | 'catalog.addProduct'
  | 'catalog.uploadImage'
  | 'catalog.deleteImage'
  | 'catalog.printLabels'
  | 'catalog.manageFavorites'
  | 'catalog.manageKits'
  | 'catalog.viewProgress'
  | 'crm.use'
  | 'ops.view'
  | 'comms.useTalk'
  | 'comms.manageTalk'
  | 'admin.manageUsers'
  | 'admin.viewRoleMatrix'
  | 'admin.editRoleMatrix';

export interface CapabilityDef {
  id: CapabilityId;
  label: string;
  description: string;
  group: CapabilityGroup;
  /** Powiązane uprawnienie w macierzy ról (brak = tylko moduł buildu). */
  roleAction?: RoleAction;
  /** Moduł wymagany w buildzie (VITE_APP_PRODUCT). */
  moduleId?: HubModuleId;
  requires?: CapabilityId[];
  /** Gość nie ma wiersza w macierzy kont — tylko podgląd. */
  guestVisible?: boolean;
}

export const GROUP_LABELS: Record<CapabilityGroup, string> = {
  modules: 'Moduły w tym buildzie',
  catalog: 'Katalog produktów',
  crm: 'CRM / handlowiec',
  ops: 'Operacje / analityka',
  comms: 'Talk / komunikacja',
  admin: 'Administracja kont',
};

export const GROUP_ORDER: CapabilityGroup[] = [
  'modules',
  'catalog',
  'crm',
  'ops',
  'comms',
  'admin',
];

export const CAPABILITY_REGISTRY: CapabilityDef[] = [
  {
    id: 'module.catalog',
    label: 'Katalog',
    description: 'Produkty, wyszukiwarka, filtry, szczegóły SKU',
    group: 'modules',
    moduleId: 'catalog',
  },
  {
    id: 'module.crm',
    label: 'CRM',
    description: 'Panel handlowca, klienci, koszyk, mapa tras',
    group: 'modules',
    moduleId: 'crm',
  },
  {
    id: 'module.ops',
    label: 'Operacje',
    description: 'Kalkulatory, marże, finanse, dead stock',
    group: 'modules',
    moduleId: 'ops',
  },
  {
    id: 'module.comms',
    label: 'Talk',
    description: 'Czat zespołu, wątki, powiadomienia',
    group: 'modules',
    moduleId: 'comms',
  },
  {
    id: 'module.calendar',
    label: 'Kalendarz',
    description: 'Wizyty, dostawy, wydarzenia firmowe',
    group: 'modules',
    moduleId: 'calendar',
  },
  {
    id: 'catalog.viewImages',
    label: 'Podgląd zdjęć',
    description: 'Galeria i miniaturki produktów',
    group: 'catalog',
    roleAction: 'viewImages',
    moduleId: 'catalog',
    requires: ['module.catalog'],
    guestVisible: true,
  },
  {
    id: 'catalog.switchCatalog',
    label: 'Przełączanie katalogów',
    description: 'Sklep vs magazyn vs inne widoki produktów',
    group: 'catalog',
    roleAction: 'switchCatalog',
    moduleId: 'catalog',
    requires: ['module.catalog'],
    guestVisible: true,
  },
  {
    id: 'catalog.viewPrices',
    label: 'Ceny i marża',
    description: 'Ceny zakupu, sprzedaży i marża w karcie produktu',
    group: 'catalog',
    roleAction: 'viewPrices',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'catalog.editStock',
    label: 'Edycja stanów',
    description: 'Korekty ±1 i sync z WAPRO',
    group: 'catalog',
    roleAction: 'editStock',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'catalog.editProduct',
    label: 'Edycja produktów',
    description: 'Nazwa, kategoria, EAN, producent',
    group: 'catalog',
    roleAction: 'editProduct',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'catalog.deleteProduct',
    label: 'Usuwanie produktów',
    description: 'Trwałe usunięcie SKU z katalogu',
    group: 'catalog',
    roleAction: 'deleteProduct',
    moduleId: 'catalog',
    requires: ['module.catalog', 'catalog.editProduct'],
  },
  {
    id: 'catalog.addProduct',
    label: 'Dodawanie produktów',
    description: 'Formularz nowego SKU',
    group: 'catalog',
    roleAction: 'addProduct',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'catalog.uploadImage',
    label: 'Dodawanie zdjęć',
    description: 'Upload i kompresja zdjęć produktu',
    group: 'catalog',
    roleAction: 'uploadImage',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'catalog.deleteImage',
    label: 'Usuwanie zdjęć',
    description: 'Kasowanie zdjęć z galerii produktu',
    group: 'catalog',
    roleAction: 'deleteImage',
    moduleId: 'catalog',
    requires: ['module.catalog', 'catalog.uploadImage'],
  },
  {
    id: 'catalog.printLabels',
    label: 'Etykiety',
    description: 'Druk etykiet magazynowych',
    group: 'catalog',
    roleAction: 'printLabels',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'catalog.manageFavorites',
    label: 'Ulubione',
    description: 'Gwiazdki i lista ulubionych SKU',
    group: 'catalog',
    roleAction: 'manageFavorites',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'catalog.manageKits',
    label: 'Zestawy',
    description: 'Tworzenie i edycja zestawów produktów',
    group: 'catalog',
    roleAction: 'manageKits',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'catalog.viewProgress',
    label: 'Postęp zdjęć',
    description: 'Widok braków zdjęć i statystyk uzupełniania',
    group: 'catalog',
    roleAction: 'viewProgress',
    moduleId: 'catalog',
    requires: ['module.catalog'],
  },
  {
    id: 'crm.use',
    label: 'Panel handlowca',
    description: 'CRM, klienci, koszyk, oferty, mapa tras',
    group: 'crm',
    roleAction: 'useCrm',
    moduleId: 'crm',
    requires: ['module.crm'],
  },
  {
    id: 'ops.view',
    label: 'Operacje i kalkulatory',
    description: 'Marże, finanse, dead stock, raporty',
    group: 'ops',
    roleAction: 'viewOps',
    moduleId: 'ops',
    requires: ['module.ops'],
  },
  {
    id: 'comms.useTalk',
    label: 'Talk — korzystanie',
    description: 'Pisanie wiadomości, wątki, reakcje',
    group: 'comms',
    roleAction: 'useTalk',
    moduleId: 'comms',
    requires: ['module.comms'],
  },
  {
    id: 'comms.manageTalk',
    label: 'Talk — administracja',
    description: 'Moderacja kanałów i ustawień czatu',
    group: 'comms',
    roleAction: 'manageTalk',
    moduleId: 'comms',
    requires: ['module.comms', 'comms.useTalk'],
  },
  {
    id: 'admin.manageUsers',
    label: 'Zarządzanie kontami',
    description: 'Tworzenie użytkowników, role, reset haseł',
    group: 'admin',
    roleAction: 'manageUsers',
  },
  {
    id: 'admin.viewRoleMatrix',
    label: 'Podgląd uprawnień',
    description: 'Odczyt macierzy ról bez edycji',
    group: 'admin',
    roleAction: 'viewRoleMatrix',
  },
  {
    id: 'admin.editRoleMatrix',
    label: 'Edycja macierzy',
    description: 'Zmiana suwaków uprawnień dla ról',
    group: 'admin',
    roleAction: 'editRoleMatrix',
    requires: ['admin.viewRoleMatrix'],
  },
];

/** Mapowanie RoleAction → CapabilityId (pierwsze dopasowanie). */
export const ROLE_ACTION_TO_CAPABILITY: Partial<Record<RoleAction, CapabilityId>> =
  Object.fromEntries(
    CAPABILITY_REGISTRY.filter((d) => d.roleAction).map((d) => [d.roleAction!, d.id]),
  ) as Partial<Record<RoleAction, CapabilityId>>;

export function getCapabilityDef(id: CapabilityId): CapabilityDef | undefined {
  return CAPABILITY_REGISTRY.find((d) => d.id === id);
}

export function capabilitiesByGroup(): Map<CapabilityGroup, CapabilityDef[]> {
  const map = new Map<CapabilityGroup, CapabilityDef[]>();
  for (const g of GROUP_ORDER) map.set(g, []);
  for (const def of CAPABILITY_REGISTRY) {
    map.get(def.group)?.push(def);
  }
  return map;
}

/** Uprawnienia z macierzą ról (bez wpisów module.*). */
export function roleGatedCapabilities(): CapabilityDef[] {
  return CAPABILITY_REGISTRY.filter((d) => d.roleAction);
}
