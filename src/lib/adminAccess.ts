import { roleCan, type AppRole } from './roles';

export function canAccessAdminPanel(role: AppRole): boolean {
  return roleCan(role, 'manageUsers') || roleCan(role, 'manageTalk') || roleCan(role, 'viewRoleMatrix');
}
