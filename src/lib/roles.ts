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
  guest: 'Podgląd i wyszukiwanie — bez edycji',
  handlowiec: 'Podgląd, ulubione, Lens',
  magazynier: 'Stany, etykiety, edycja, Lens',
  operator: 'Pełna praca magazynowa — bez panelu użytkowników',
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
  | 'deleteImage'
  | 'useLens'
  | 'printLabels'
  | 'manageFavorites'
  | 'switchCatalog'
  | 'viewProgress'
  | 'manageUsers';

const ALL_FALSE: Record<RoleAction, boolean> = {
  editStock: false,
  editProduct: false,
  addProduct: false,
  deleteImage: false,
  useLens: false,
  printLabels: false,
  manageFavorites: false,
  switchCatalog: true,
  viewProgress: false,
  manageUsers: false,
};

const MATRIX: Record<AppRole, Record<RoleAction, boolean>> = {
  guest: {
    ...ALL_FALSE,
    switchCatalog: true,
  },
  handlowiec: {
    ...ALL_FALSE,
    useLens: true,
    manageFavorites: true,
    switchCatalog: true,
  },
  magazynier: {
    editStock: true,
    editProduct: true,
    addProduct: false,
    deleteImage: true,
    useLens: true,
    printLabels: true,
    manageFavorites: true,
    switchCatalog: true,
    viewProgress: true,
    manageUsers: false,
  },
  operator: {
    editStock: true,
    editProduct: true,
    addProduct: true,
    deleteImage: true,
    useLens: true,
    printLabels: true,
    manageFavorites: true,
    switchCatalog: true,
    viewProgress: true,
    manageUsers: false,
  },
  admin: {
    editStock: true,
    editProduct: true,
    addProduct: true,
    deleteImage: true,
    useLens: true,
    printLabels: true,
    manageFavorites: true,
    switchCatalog: true,
    viewProgress: true,
    manageUsers: true,
  },
};

export function roleCan(role: AppRole, action: RoleAction): boolean {
  return MATRIX[role][action];
}
