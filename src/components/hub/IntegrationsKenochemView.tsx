import {
  Cloud,
  Mail,
  MessageCircle,
  Plug,
  RefreshCw,
  Server,
  Settings2,
} from 'lucide-react';
import { dispatchHubNavigate } from '../../app/hubNavigation';
import { openGlobalAdminPanel } from '../../lib/adminNavigation';

function Card({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left ${
        onClick ? 'transition hover:border-slate-700 hover:bg-slate-900' : ''
      }`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
    </Tag>
  );
}

export function IntegrationsKenochemView() {
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-5 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <Plug className="h-6 w-6 text-violet-400" />
        <div>
          <h1 className="text-xl font-bold text-slate-50">Integracje</h1>
          <p className="text-sm text-slate-500">Połączenia produkcyjne Kenochem (bez demo SaaS huba).</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card
          icon={<Settings2 className="h-5 w-5" />}
          title="Panel administracyjny"
          desc="Konta użytkowników, role i macierz uprawnień — globalnie dla całego Kenochem."
          onClick={() => openGlobalAdminPanel()}
        />
        <Card
          icon={<Server className="h-5 w-5" />}
          title="WAPRO Mag / SQL"
          desc="Stany i ceny — agent sync na serwerze firmowym, skrypt sync-wapro-stock. UI: Odśwież / Sync w katalogu."
        />
        <Card
          icon={<Cloud className="h-5 w-5" />}
          title="Supabase"
          desc="Auth, role, CRM (klienci, zamówienia), czat Talk, skrzynka CRM w DB. Migracje w folderze supabase/."
        />
        <Card
          icon={<Mail className="h-5 w-5" />}
          title="Poczta CRM (IMAP)"
          desc="Webio biuro@ — crm-mail-pull.mjs + Harmonogram Windows. Edge crm-mail opcjonalnie; produkcja = serwer."
          onClick={() => dispatchHubNavigate('crm')}
        />
        <Card
          icon={<MessageCircle className="h-5 w-5" />}
          title="Discord — zamówienia"
          desc="Webhook z env przy wysyłce oferty/zamówienia z CRM (jak w Handel)."
        />
        <Card
          icon={<RefreshCw className="h-5 w-5" />}
          title="Import produktów"
          desc="Skrypty npm / data — embeddingi sklepu, ceny, katalog Akcesoria vs Produkty."
          onClick={() => dispatchHubNavigate('catalog')}
        />
      </div>
    </div>
  );
}
