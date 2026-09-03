import { APP_PRODUCT } from '../app/moduleRegistry';
import { dispatchHubNavigate } from '../app/hubNavigation';
import { dispatchAppView } from '../suite/hubViewMap';

/** Otwórz globalny panel administracji — działa w Suite i standalone. */
export function openGlobalAdminPanel(): void {
  dispatchAppView('admin');
  if (APP_PRODUCT === 'suite') {
    dispatchHubNavigate('admin');
  }
}
