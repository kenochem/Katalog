export type AppRole = 'guest' | 'handlowiec' | 'magazynier' | 'operator' | 'admin';

/** Role konta w bazie (bez guest — gość nie ma profilu). */
export type AccountRole = Exclude<AppRole, 'guest'>;

export type UserRole = AppRole;

export const ACCOUNT_ROLES: AccountRole[] = [
  'admin',
  'operator',
  'magazynier',
  'handlowiec',
];

export const APP_ROLES: AppRole[] = ['guest', ...ACCOUNT_ROLES];

export const ROLE_LABELS: Record<AppRole, string> = {
  guest: 'Gość',
  handlowiec: 'Handlowiec',
  magazynier: 'Magazynier',
  operator: 'Operator',
  admin: 'Admin',
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  guest: 'Podgląd katalogu ze zdjęciami — bez edycji, etykiet, zamówień i usuwania',
  handlowiec:
    'Katalog, CRM (panel handlowca), oferty, ceny, operacje — bez stanów, usuwania zdjęć i kont',
  magazynier:
    'Stany, etykiety, dodawanie zdjęć — bez zamówień, zestawów, edycji produktów, cen i kont',
  operator:
    'Pełna praca (stany, produkty, zestawy, CRM, ceny, operacje) — bez panelu kont',
  admin: 'Pełny dostęp + zarządzanie użytkownikami i podgląd uprawnień',
};

export function isAccountRole(v: unknown): v is AccountRole {
  return (
    v === 'admin' ||
    v === 'operator' ||
    v === 'magazynier' ||
    v === 'handlowiec'
  );
}

export function isAppRole(v: unknown): v is AppRole {
  return v === 'guest' || isAccountRole(v);
}

/** Uprawnienia UI (ochrona RLS produktów — follow-up). */
export type RoleAction =
  | 'editStock'
  | 'editProduct'
  | 'deleteProduct'
  | 'addProduct'
  | 'uploadImage'
  | 'deleteImage'
  | 'printLabels'
  | 'manageFavorites'
  | 'manageKits'
  | 'switchCatalog'
  | 'viewProgress'
  | 'viewImages'
  | 'viewPrices'
  | 'manageUsers'
  | 'useTalk'
  | 'manageTalk'
  | 'useCrm'
  | 'viewRoleMatrix'
  | 'viewOps';

export const ROLE_ACTION_LABELS: Record<RoleAction, string> = {
  editStock: 'Edycja stanów',
  editProduct: 'Edycja produktów',
  deleteProduct: 'Usuwanie produktów',
  addProduct: 'Dodawanie produktów',
  uploadImage: 'Dodawanie zdjęć',
  deleteImage: 'Usuwanie zdjęć',
  printLabels: 'Etykiety',
  manageFavorites: 'Ulubione',
  manageKits: 'Zestawy',
  switchCatalog: 'Przełączanie katalogów',
  viewProgress: 'Postęp zdjęć',
  viewImages: 'Podgląd zdjęć',
  viewPrices: 'Ceny i marża',
  manageUsers: 'Zarządzanie kontami',
  useTalk: 'Talk / czat',
  manageTalk: 'Administracja Talk',
  useCrm: 'CRM / panel handlowca',
  viewRoleMatrix: 'Podgląd uprawnień',
  viewOps: 'Operacje / kalkulatory',
};

export const ROLE_ACTIONS: RoleAction[] = Object.keys(
  ROLE_ACTION_LABELS,
) as RoleAction[];

const ALL_FALSE: Record<RoleAction, boolean> = {
  editStock: false,
  editProduct: false,
  deleteProduct: false,
  addProduct: false,
  uploadImage: false,
  deleteImage: false,
  printLabels: false,
  manageFavorites: false,
  manageKits: false,
  switchCatalog: false,
  viewProgress: false,
  viewImages: false,
  viewPrices: false,
  manageUsers: false,
  useTalk: false,
  manageTalk: false,
  useCrm: false,
  viewRoleMatrix: false,
  viewOps: false,
};

/** Domyślna macierz — później można nadpisać z DB. */
export const DEFAULT_ROLE_MATRIX: Record<AppRole, Record<RoleAction, boolean>> = {
  guest: {
    ...ALL_FALSE,
    switchCatalog: true,
    viewImages: true,
    useTalk: false,
  },
  handlowiec: {
    ...ALL_FALSE,
    editProduct: true,
    addProduct: true,
    uploadImage: true,
    printLabels: true,
    manageFavorites: true,
    manageKits: true,
    switchCatalog: true,
    viewProgress: true,
    viewImages: true,
    viewPrices: true,
    useTalk: true,
    useCrm: true,
    viewOps: true,
  },
  magazynier: {
    ...ALL_FALSE,
    editStock: true,
    uploadImage: true,
    printLabels: true,
    manageFavorites: true,
    switchCatalog: true,
    viewProgress: true,
    viewImages: true,
    useTalk: true,
  },
  operator: {
    editStock: true,
    editProduct: true,
    deleteProduct: true,
    addProduct: true,
    uploadImage: true,
    deleteImage: true,
    printLabels: true,
    manageFavorites: true,
    manageKits: true,
    switchCatalog: true,
    viewProgress: true,
    viewImages: true,
    viewPrices: true,
    manageUsers: false,
    useTalk: true,
    manageTalk: false,
    useCrm: true,
    viewRoleMatrix: false,
    viewOps: true,
  },
  admin: {
    editStock: true,
    editProduct: true,
    deleteProduct: true,
    addProduct: true,
    uploadImage: true,
    deleteImage: true,
    printLabels: true,
    manageFavorites: true,
    manageKits: true,
    switchCatalog: true,
    viewProgress: true,
    viewImages: true,
    viewPrices: true,
    manageUsers: true,
    useTalk: true,
    manageTalk: true,
    useCrm: true,
    viewRoleMatrix: true,
    viewOps: true,
  },
};
