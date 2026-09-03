import { moduleEnabled } from '../../app/moduleRegistry';
import type { AppRole, RoleAction } from '../roleDefinitions';
import { getRoleMatrix, roleCan } from '../roleMatrixStore';
import {
  CAPABILITY_REGISTRY,
  type CapabilityDef,
  type CapabilityGroup,
  type CapabilityId,
  GROUP_ORDER,
  capabilitiesByGroup,
  getCapabilityDef,
} from './capabilityRegistry';

export function isModuleCapabilityAvailable(def: CapabilityDef): boolean {
  if (!def.moduleId) return true;
  return moduleEnabled(def.moduleId);
}

function dependencyMet(
  def: CapabilityDef,
  role: AppRole,
  resolved: Map<CapabilityId, boolean>,
): boolean {
  if (!def.requires?.length) return true;
  return def.requires.every((reqId) => {
    const req = getCapabilityDef(reqId);
    if (!req) return true;
    if (req.moduleId && !moduleEnabled(req.moduleId)) return false;
    if (req.roleAction) return resolved.get(reqId) ?? roleCan(role, req.roleAction);
    return resolved.get(reqId) ?? true;
  });
}

/** Czy rola ma dane uprawnienie (moduł buildu + macierz + zależności). */
export function canAccessCapability(role: AppRole, capabilityId: CapabilityId): boolean {
  const def = getCapabilityDef(capabilityId);
  if (!def) return false;
  if (def.moduleId && !moduleEnabled(def.moduleId)) return false;

  const resolved = new Map<CapabilityId, boolean>();
  for (const d of CAPABILITY_REGISTRY) {
    if (!d.roleAction) {
      resolved.set(d.id, !d.moduleId || moduleEnabled(d.moduleId));
      continue;
    }
    resolved.set(d.id, roleCan(role, d.roleAction));
  }

  if (def.roleAction && !roleCan(role, def.roleAction)) return false;
  return dependencyMet(def, role, resolved);
}

export function canAccessAction(role: AppRole, action: RoleAction): boolean {
  return roleCan(role, action);
}

export interface RolePermissionSummary {
  role: AppRole;
  enabled: CapabilityDef[];
  byGroup: Map<CapabilityGroup, CapabilityDef[]>;
  total: number;
}

export function summarizeRolePermissions(role: AppRole): RolePermissionSummary {
  const enabled = roleGatedCapabilitiesForRole(role);
  const byGroup = new Map<CapabilityGroup, CapabilityDef[]>();
  for (const g of GROUP_ORDER) byGroup.set(g, []);
  for (const def of enabled) {
    byGroup.get(def.group)?.push(def);
  }
  return { role, enabled, byGroup, total: enabled.length };
}

export function roleGatedCapabilitiesForRole(role: AppRole): CapabilityDef[] {
  return CAPABILITY_REGISTRY.filter(
    (d) => d.roleAction && isModuleCapabilityAvailable(d) && canAccessCapability(role, d.id),
  );
}

export function countEnabledActions(role: AppRole): number {
  const matrix = getRoleMatrix()[role];
  return Object.values(matrix).filter(Boolean).length;
}

export function compareRoles(
  from: AppRole,
  to: AppRole,
): { gained: CapabilityDef[]; lost: CapabilityDef[] } {
  const fromSet = new Set(roleGatedCapabilitiesForRole(from).map((d) => d.id));
  const toCaps = roleGatedCapabilitiesForRole(to);
  const gained = toCaps.filter((d) => !fromSet.has(d.id));
  const toSet = new Set(toCaps.map((d) => d.id));
  const lost = roleGatedCapabilitiesForRole(from).filter((d) => !toSet.has(d.id));
  return { gained, lost };
}

export { capabilitiesByGroup, GROUP_ORDER };
