import type { CrmTab } from '../components/crm/CrmSubNav';
import { dispatchHubNavigate } from '../app/hubNavigation';

export function dispatchCrmTab(tab: CrmTab) {
  dispatchHubNavigate('crm');
  window.dispatchEvent(new CustomEvent('katalog-crm-tab', { detail: { tab } }));
}

export type OpsToolId =
  | 'hub'
  | 'margin-rank'
  | 'marketplace'
  | 'finance'
  | 'abc'
  | 'alerts';

export function dispatchOpsTool(tool: OpsToolId) {
  dispatchHubNavigate('ops');
  window.dispatchEvent(new CustomEvent('katalog-ops-tool', { detail: { tool } }));
}
