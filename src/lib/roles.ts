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
    'Zamówienia, oferty, zdjęcia (dodawanie), katalog — bez stanów, usuwania zdjęć i kont',
  magazynier:
    'Stany, etykiety, dodawanie zdjęć — bez zamówień, zestawów, edycji produktów i kont',
  operator: 'Pełna praca (stany, produkty, zestawy, zamówienia) — bez panelu kont',
  admin: 'Pełny dostęp + zarządzanie użytkownikami',
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
  | 'addProduct'
  | 'uploadImage'
  | 'deleteImage'
  | 'useLens'
  | 'printLabels'
  | 'manageFavorites'
  | 'manageKits'
  | 'switchCatalog'
  | 'viewProgress'
  | 'viewImages'
  | 'manageUsers'
  | 'useCrm';

const ALL_FALSE: Record<RoleAction, boolean> = {
  editStock: false,
  editProduct: false,
  addProduct: false,
  uploadImage: false,
  deleteImage: false,
  useLens: false,
  printLabels: false,
  manageFavorites: false,
  manageKits: false,
  switchCatalog: false,
  viewProgress: false,
  viewImages: false,
  manageUsers: false,
  useCrm: false,
};

const MATRIX: Record<AppRole, Record<RoleAction, boolean>> = {
  guest: {
    ...ALL_FALSE,
    switchCatalog: true,
    viewImages: true, // zdjęcia tak; upload/delete zostają false
  },
  handlowiec: {
    ...ALL_FALSE,
    editProduct: true,
    addProduct: true,
    uploadImage: true,
    useLens: true,
    printLabels: true,
    manageFavorites: true,
    manageKits: true,
    switchCatalog: true,
    viewProgress: true,
    viewImages: true,
    useCrm: true,
  },
  magazynier: {
    ...ALL_FALSE,
    editStock: true,
    uploadImage: true,
    useLens: true,
    printLabels: true,
    manageFavorites: true,
    switchCatalog: true,
    viewProgress: true,
    viewImages: true,
  },
  operator: {
    editStock: true,
    editProduct: true,
    addProduct: true,
    uploadImage: true,
    deleteImage: true,
    useLens: true,
    printLabels: true,
    manageFavorites: true,
    manageKits: true,
    switchCatalog: true,
    viewProgress: true,
    viewImages: true,
    manageUsers: false,
    useCrm: true,
  },
  admin: {
    editStock: true,
    editProduct: true,
    addProduct: true,
    uploadImage: true,
    deleteImage: true,
    useLens: true,
    printLabels: true,
    manageFavorites: true,
    manageKits: true,
    switchCatalog: true,
    viewProgress: true,
    viewImages: true,
    manageUsers: true,
    useCrm: true,
  },
};

export function roleCan(role: AppRole, action: RoleAction): boolean {
  return MATRIX[role][action];
}
