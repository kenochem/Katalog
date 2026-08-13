import type { AppRole } from '../lib/roles';
import { roleCan } from '../lib/roles';
import { moduleEnabled } from './moduleRegistry';

export function canUseCrmModule(role: AppRole): boolean {
  return moduleEnabled('crm') && roleCan(role, 'useCrm');
}

export function canViewOpsModule(role: AppRole): boolean {
  return moduleEnabled('ops') && roleCan(role, 'viewOps');
}

export function canUseCommsModule(): boolean {
  return moduleEnabled('comms');
}
