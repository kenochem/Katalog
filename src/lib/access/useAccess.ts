import { useCallback, useMemo } from 'react';
import { useAuth } from '../auth';
import type { HubModuleId } from '../../app/moduleRegistry';
import { moduleEnabled } from '../../app/moduleRegistry';
import type { RoleAction } from '../roleDefinitions';
import { roleCan } from '../roleMatrixStore';
import {
  canAccessAction,
  canAccessCapability,
  type RolePermissionSummary,
  summarizeRolePermissions,
} from './accessControl';
import type { CapabilityId } from './capabilityRegistry';

export function useAccess() {
  const { role, roleMatrixRevision } = useAuth();
  void roleMatrixRevision;

  const can = useCallback(
    (action: RoleAction) => canAccessAction(role, action),
    [role],
  );

  const canCap = useCallback(
    (id: CapabilityId) => canAccessCapability(role, id),
    [role],
  );

  const hasModule = useCallback(
    (id: HubModuleId) => moduleEnabled(id),
    [],
  );

  const summary = useMemo<RolePermissionSummary>(
    () => summarizeRolePermissions(role),
    [role, roleMatrixRevision],
  );

  return {
    role,
    can,
    canCap,
    hasModule,
    roleCan: (action: RoleAction) => roleCan(role, action),
    summary,
  };
}
