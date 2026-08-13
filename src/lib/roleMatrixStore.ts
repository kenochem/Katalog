import {
  APP_ROLES,
  DEFAULT_ROLE_MATRIX,
  ROLE_ACTIONS,
  type AppRole,
  type RoleAction,
} from './roleDefinitions';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'kenochem-role-matrix-v1';
const CLOUD_ROW_ID = 'default';
export const ROLE_MATRIX_CHANGED = 'role-matrix-changed';

export type RoleMatrix = Record<AppRole, Record<RoleAction, boolean>>;

function cloneMatrix(source: RoleMatrix): RoleMatrix {
  return JSON.parse(JSON.stringify(source)) as RoleMatrix;
}

export function isValidRoleMatrix(raw: unknown): raw is RoleMatrix {
  if (!raw || typeof raw !== 'object') return false;
  for (const role of APP_ROLES) {
    const row = (raw as RoleMatrix)[role];
    if (!row || typeof row !== 'object') return false;
    for (const action of ROLE_ACTIONS) {
      if (typeof row[action] !== 'boolean') return false;
    }
  }
  return true;
}

function loadMatrixFromLocal(): RoleMatrix {
  if (typeof localStorage === 'undefined') {
    return cloneMatrix(DEFAULT_ROLE_MATRIX);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneMatrix(DEFAULT_ROLE_MATRIX);
    const parsed: unknown = JSON.parse(raw);
    if (!isValidRoleMatrix(parsed)) return cloneMatrix(DEFAULT_ROLE_MATRIX);
    return parsed;
  } catch {
    return cloneMatrix(DEFAULT_ROLE_MATRIX);
  }
}

function cacheMatrixLocally(next: RoleMatrix): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

let matrix: RoleMatrix = loadMatrixFromLocal();

function notifyChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ROLE_MATRIX_CHANGED));
  }
}

function applyMatrix(next: RoleMatrix): void {
  matrix = next;
  cacheMatrixLocally(next);
  notifyChanged();
}

export function getRoleMatrix(): RoleMatrix {
  return matrix;
}

let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
let cloudSaveUserId: string | null = null;

async function flushRoleMatrixToCloud(): Promise<void> {
  if (!cloudSaveUserId || !isSupabaseConfigured || !supabase) return;
  const userId = cloudSaveUserId;
  cloudSaveUserId = null;
  const { error } = await supabase.from('app_role_matrix').upsert(
    {
      id: CLOUD_ROW_ID,
      matrix,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('role_matrix save', error);
}

export function scheduleRoleMatrixCloudSave(userId: string): void {
  if (!userId || !isSupabaseConfigured) return;
  cloudSaveUserId = userId;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    cloudSaveTimer = null;
    void flushRoleMatrixToCloud();
  }, 500);
}

/** Wczytaj macierz z Supabase (cache lokalny jako fallback). */
export async function hydrateRoleMatrixFromCloud(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data, error } = await supabase
    .from('app_role_matrix')
    .select('matrix')
    .eq('id', CLOUD_ROW_ID)
    .maybeSingle();
  if (error) {
    console.warn('role_matrix fetch', error);
    return;
  }
  const raw = data?.matrix;
  if (!isValidRoleMatrix(raw)) return;
  applyMatrix(raw);
}

export function setRoleMatrixCell(
  role: AppRole,
  action: RoleAction,
  value: boolean,
  adminUserId?: string,
): void {
  if (role === 'guest') return;
  applyMatrix({
    ...matrix,
    [role]: { ...matrix[role], [action]: value },
  });
  if (adminUserId) scheduleRoleMatrixCloudSave(adminUserId);
}

export function resetRoleMatrixToDefault(adminUserId?: string): void {
  applyMatrix(cloneMatrix(DEFAULT_ROLE_MATRIX));
  if (adminUserId) scheduleRoleMatrixCloudSave(adminUserId);
}

export function reloadRoleMatrixFromStorage(): void {
  matrix = loadMatrixFromLocal();
}

export function roleCan(role: AppRole, action: RoleAction): boolean {
  return getRoleMatrix()[role][action];
}
