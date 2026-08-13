export type HubView =
  | 'workspace'
  | 'home'
  | 'catalog'
  | 'favorites'
  | 'kits'
  | 'warehouse'
  | 'logistics'
  | 'finance'
  | 'social'
  | 'crm'
  | 'orders'
  | 'ops'
  | 'comms'
  | 'team'
  | 'admin'
  | 'inbox'
  | 'integrations'
  | 'departments'
  | 'downloads'
  | 'guide'
  | 'assist'
  | 'calendar';

export type CrmNavTab =
  | 'hub'
  | 'order'
  | 'clients'
  | 'history'
  | 'routes'
  | 'commission'
  | 'pipeline';

export function dispatchHubNavigate(view: HubView) {
  window.dispatchEvent(new CustomEvent('katalog-hub-navigate', { detail: { view } }));
}
