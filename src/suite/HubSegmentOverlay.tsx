import type { HubView } from '../app/hubNavigation';
import type { AppRole } from '../lib/roles';
import { canAccessAdminPanel } from '../lib/adminAccess';
import { canUseCrmModule, canViewOpsModule, canUseCommsModule } from '../app/productAccess';
import { WorkspaceKenochemView } from '../components/hub/WorkspaceKenochemView';
import { WarehouseKenochemView } from '../components/hub/WarehouseKenochemView';
import { LogisticsKenochemView } from '../components/hub/LogisticsKenochemView';
import { FinanceKenochemView } from '../components/hub/FinanceKenochemView';
import { CalendarKenochemView } from '../components/hub/CalendarKenochemView';
import { HubAppPreviewView } from '../components/hub/HubAppPreviewView';
import { OrdersKenochemView } from '../components/hub/OrdersKenochemView';
import { IntegrationsKenochemView } from '../components/hub/IntegrationsKenochemView';
import { HubGuideKenochemView } from '../components/hub/HubGuideKenochemView';
import { HubDownloadsKenochemView } from '../components/hub/HubDownloadsKenochemView';
import { HubSegmentPlaceholder } from '../components/hub/HubSegmentPlaceholder';

export interface HubSegmentOverlayProps {
  hubView: HubView;
  onHubViewChange: (v: HubView) => void;
  role: AppRole;
  modeSignedIn: boolean;
  favoriteCount: number;
  orderCount: number;
  productCount: number;
  missingImagesCount: number;
  lowStockCount: number;
  labelQueueCount: number;
}

export function HubSegmentOverlay({
  hubView: hv,
  onHubViewChange,
  role,
  modeSignedIn,
  favoriteCount,
  orderCount,
  productCount,
  missingImagesCount,
  lowStockCount,
  labelQueueCount,
}: HubSegmentOverlayProps) {
  if (hv === 'workspace') {
    return (
      <WorkspaceKenochemView
        favoriteCount={favoriteCount}
        orderCount={orderCount}
        productCount={productCount}
        onNavigate={onHubViewChange}
        canCrm={canUseCrmModule(role)}
        canOps={canViewOpsModule(role)}
        canComms={canUseCommsModule()}
      />
    );
  }
  if (hv === 'warehouse') {
    return (
      <WarehouseKenochemView
        productCount={productCount}
        missingImagesCount={missingImagesCount}
        lowStockCount={lowStockCount}
        labelQueueCount={labelQueueCount}
      />
    );
  }
  if (hv === 'logistics') {
    return <LogisticsKenochemView />;
  }
  if (hv === 'orders' && canUseCrmModule(role)) {
    return <OrdersKenochemView cloudEnabled={modeSignedIn} />;
  }
  if (hv === 'finance' && canViewOpsModule(role)) {
    return <FinanceKenochemView />;
  }
  if (hv === 'catalog') {
    return (
      <HubAppPreviewView
        kind="catalog"
        productCount={productCount}
        favoriteCount={favoriteCount}
        orderCount={orderCount}
        lowStockCount={lowStockCount}
        missingImagesCount={missingImagesCount}
        onNavigate={onHubViewChange}
      />
    );
  }
  if (hv === 'crm' && canUseCrmModule(role)) {
    return (
      <HubAppPreviewView
        kind="crm"
        productCount={productCount}
        favoriteCount={favoriteCount}
        orderCount={orderCount}
        lowStockCount={lowStockCount}
        missingImagesCount={missingImagesCount}
        onNavigate={onHubViewChange}
      />
    );
  }
  if (hv === 'ops' && canViewOpsModule(role)) {
    return (
      <HubAppPreviewView
        kind="ops"
        productCount={productCount}
        favoriteCount={favoriteCount}
        orderCount={orderCount}
        lowStockCount={lowStockCount}
        missingImagesCount={missingImagesCount}
        onNavigate={onHubViewChange}
      />
    );
  }
  if (hv === 'comms' && canUseCommsModule()) {
    return (
      <HubAppPreviewView
        kind="talk"
        productCount={productCount}
        favoriteCount={favoriteCount}
        orderCount={orderCount}
        lowStockCount={lowStockCount}
        missingImagesCount={missingImagesCount}
        onNavigate={onHubViewChange}
      />
    );
  }
  if (hv === 'calendar') {
    return <CalendarKenochemView onNavigate={onHubViewChange} />;
  }
  if (hv === 'integrations' && canAccessAdminPanel(role)) {
    return <IntegrationsKenochemView />;
  }
  if (hv === 'downloads') {
    return <HubDownloadsKenochemView />;
  }
  if (hv === 'guide') {
    return <HubGuideKenochemView />;
  }
  const placeholderViews: HubView[] = [
    'assist',
    'departments',
    'inbox',
    'team',
    'social',
  ];
  if (placeholderViews.includes(hv)) {
    return <HubSegmentPlaceholder view={hv} />;
  }
  return null;
}
