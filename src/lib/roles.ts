export type UserRole = 'admin' | 'magazynier' | 'robol';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  magazynier: 'Magazynier',
  robol: 'Robol',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Pełny dostęp (funkcje doprecyzujemy później)',
  magazynier: 'Stany, etykiety, katalog (później)',
  robol: 'Podstawowy podgląd / praca (później)',
};

const ROLE_KEY = 'katalog-role';

export function isUserRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'magazynier' || v === 'robol';
}

export function getRole(): UserRole {
  try {
    const v = localStorage.getItem(ROLE_KEY);
    if (isUserRole(v)) return v;
  } catch {
    /* ignore */
  }
  return 'admin';
}

export function setRole(role: UserRole): void {
  localStorage.setItem(ROLE_KEY, role);
}

/** Uprawnienia — szkielet; logowanie później. */
export type RoleAction =
  | 'editStock'
  | 'editProduct'
  | 'addProduct'
  | 'deleteImage'
  | 'useLens'
  | 'printLabels'
  | 'manageFavorites'
  | 'switchCatalog'
  | 'viewProgress';

const MATRIX: Record<UserRole, Record<RoleAction, boolean>> = {
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
  },
  robol: {
    editStock: false,
    editProduct: false,
    addProduct: false,
    deleteImage: false,
    useLens: true,
    printLabels: false,
    manageFavorites: true,
    switchCatalog: true,
    viewProgress: false,
  },
};

export function roleCan(role: UserRole, action: RoleAction): boolean {
  return MATRIX[role][action];
}
