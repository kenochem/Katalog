// WYGENEROWANE przez scripts/generate-migration-probes.mjs — nie edytuj ręcznie.
export interface MigrationProbe {
  file: string;
  title: string;
  tables: string[];
  /** Kolumny w postaci tabela.kolumna */
  columns: string[];
  functions: string[];
}

export const MIGRATION_PROBES: MigrationProbe[] = [
  {
    "file": "migration-app-settings.sql",
    "title": "Globalne ustawienia aplikacji (feature flags), edytowalne przez admina w panelu.",
    "tables": [
      "app_settings"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-audit-log-ip-device.sql",
    "title": "Dziennik aktywnosci: adres IP (odczytywany PO STRONIE SERWERA) i dane urzadzenia.",
    "tables": [],
    "columns": [
      "audit_log.ip"
    ],
    "functions": [
      "audit_log_write"
    ]
  },
  {
    "file": "migration-audit-log-self-read.sql",
    "title": "Statystyki i odznaki w \"Moj profil\": kazdy zalogowany moze ODCZYTAC wlasne wpisy dziennika aktywnosci.",
    "tables": [],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-audit-log.sql",
    "title": "Dziennik aktywnosci uzytkownikow (audit log): kto, co i kiedy zmienil.",
    "tables": [
      "audit_log"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-auth-profiles.sql",
    "title": "Auth + profiles (Supabase Auth)",
    "tables": [
      "profiles"
    ],
    "columns": [],
    "functions": [
      "is_admin",
      "handle_new_user"
    ]
  },
  {
    "file": "migration-baselinker-sync-log.sql",
    "title": "BaseLinker: historia wysylek (log) + cache ceny BL w baselinker_links.",
    "tables": [
      "baselinker_sync_log"
    ],
    "columns": [
      "baselinker_links.bl_price_gross"
    ],
    "functions": []
  },
  {
    "file": "migration-baselinker.sql",
    "title": "BaseLinker: mapowanie SKU katalogu -> ID produktu w BaseLinker (cache, odswiezane akcja \"compare\").",
    "tables": [
      "baselinker_links"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-catalog-brand-overrides.sql",
    "title": "Uruchom w Supabase SQL Editor",
    "tables": [
      "catalog_product_overrides"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-catalog-leaderboard.sql",
    "title": "Ranking pracownikow w \"Moj profil\": punkty pracy (XP) z dziennika aktywnosci.",
    "tables": [],
    "columns": [],
    "functions": [
      "catalog_leaderboard"
    ]
  },
  {
    "file": "migration-catalog-manufacturers.sql",
    "title": "Wspólny rejestr producentów (marek) katalogu + ich profile (logo, opis, kontakt).",
    "tables": [
      "catalog_manufacturers"
    ],
    "columns": [
      "catalog_manufacturers.logo_url",
      "catalog_manufacturers.description",
      "catalog_manufacturers.website",
      "catalog_manufacturers.email",
      "catalog_manufacturers.phone",
      "catalog_manufacturers.notes",
      "catalog_manufacturers.removed",
      "catalog_manufacturers.updated_at"
    ],
    "functions": []
  },
  {
    "file": "migration-catalog-tasks.sql",
    "title": "Moja kolejka: zadania w katalogu przydzielane osobom (uzupelnij zdjecie, zatwierdz opis, sprawdz dane...)",
    "tables": [
      "catalog_tasks"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-catalog.sql",
    "title": "Uruchom w Supabase SQL Editor",
    "tables": [],
    "columns": [
      "products.catalog"
    ],
    "functions": []
  },
  {
    "file": "migration-chat-files-read-receipts.sql",
    "title": "Talk: pliki do 2 MB + statusy dostarczenia/odczytu per wiadomość",
    "tables": [
      "chat_message_reads"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-chat-peers-avatar.sql",
    "title": "Avatar w liście osób do DM (RPC security definer)",
    "tables": [],
    "columns": [],
    "functions": [
      "list_chat_peers"
    ]
  },
  {
    "file": "migration-chat-push-logs.sql",
    "title": "",
    "tables": [
      "chat_push_logs"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-chat-push-subscriptions.sql",
    "title": "TASK 3 (push) — tabela subskrypcji Web Push",
    "tables": [
      "chat_push_subscriptions"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-chat-reactions-edit.sql",
    "title": "Reakcje emoji + edycja własnych wiadomości (jak hub-platform)",
    "tables": [
      "chat_message_reactions"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-chat-reply-thanks.sql",
    "title": "Odpowiedzi na wiadomości + „Dzięki” (jedna reakcja na usera / wiadomość)",
    "tables": [
      "chat_message_thanks"
    ],
    "columns": [
      "chat_messages.reply_to_id"
    ],
    "functions": [
      "chat_messages_reply_same_thread"
    ]
  },
  {
    "file": "migration-chat-voice-bucket.sql",
    "title": "TASK 2 (głosówki) — tylko Storage",
    "tables": [],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-chat-voice-push.sql",
    "title": "Talk: głosówki + push (całość) LUB osobno:",
    "tables": [
      "chat_push_subscriptions"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-chat.sql",
    "title": "Chat: kanał ogólny + DM (Supabase Realtime)",
    "tables": [
      "chat_threads",
      "chat_thread_members",
      "chat_messages"
    ],
    "columns": [],
    "functions": [
      "chat_can_access_thread",
      "list_chat_peers",
      "get_or_create_dm",
      "mark_chat_thread_read"
    ]
  },
  {
    "file": "migration-crm-client-geo.sql",
    "title": "CRM: współrzędne klientów (mapa + trasy)",
    "tables": [],
    "columns": [
      "crm_clients.lat"
    ],
    "functions": []
  },
  {
    "file": "migration-crm-client-icon.sql",
    "title": "CRM: ikona typu klienta (osoba, firma, myjnia, silownia, warsztat, sklep...).",
    "tables": [],
    "columns": [
      "crm_clients.icon"
    ],
    "functions": []
  },
  {
    "file": "migration-crm-client-tags.sql",
    "title": "CRM: tagi/segmentacja klientow (np. VIP, ryzykowny, nowy prospekt).",
    "tables": [],
    "columns": [
      "crm_clients.tags"
    ],
    "functions": []
  },
  {
    "file": "migration-crm-clients-orders.sql",
    "title": "CRM: własni klienci + historia zamówień (per auth user)",
    "tables": [
      "crm_clients",
      "crm_orders"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-crm-lead-owner.sql",
    "title": "CRM: przypisanie leada do konkretnego handlowca (nazwa widoczna na karcie).",
    "tables": [],
    "columns": [
      "crm_leads.owner_name"
    ],
    "functions": []
  },
  {
    "file": "migration-crm-mailbox.sql",
    "title": "Skrzynka e-mail CRM (IMAP/SMTP) — uruchom w Supabase SQL Editor",
    "tables": [
      "crm_mailbox_settings",
      "crm_mailbox_credentials",
      "crm_inbox_sync"
    ],
    "columns": [
      "crm_mailbox_settings.last_imap_uid"
    ],
    "functions": []
  },
  {
    "file": "migration-crm-notes.sql",
    "title": "CRM: notatki wlasne handlowca, opcjonalnie oznaczone klientem lub leadem.",
    "tables": [
      "crm_notes"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-crm-personal-stores.sql",
    "title": "CRM: przeniesienie danych z localStorage (kalendarz, lejek sprzedaży, notatki klienta,",
    "tables": [
      "crm_calendar_events",
      "crm_leads",
      "crm_client_notes",
      "crm_user_settings",
      "crm_tasks"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-crm-quote-history.sql",
    "title": "CRM: historia wygenerowanych ofert (per uzytkownik, RLS jak crm_orders).",
    "tables": [],
    "columns": [
      "crm_orders.quote_number"
    ],
    "functions": []
  },
  {
    "file": "migration-crm-quote-number.sql",
    "title": "CRM: wspolny, rosnacy numer oferty (np. OF/2026/00042).",
    "tables": [],
    "columns": [],
    "functions": [
      "next_crm_quote_number"
    ]
  },
  {
    "file": "migration-extra-images.sql",
    "title": "Uruchom w Supabase SQL Editor",
    "tables": [],
    "columns": [
      "products.extra_images"
    ],
    "functions": []
  },
  {
    "file": "migration-grants-fix.sql",
    "title": "Uprawnienia (GRANT) do nowszych tabel katalogu dla zalogowanych użytkowników.",
    "tables": [],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-groups.sql",
    "title": "Uruchom w Supabase SQL Editor przed import:supabase",
    "tables": [],
    "columns": [
      "products.variants",
      "products.is_group"
    ],
    "functions": []
  },
  {
    "file": "migration-kits-code-meta.sql",
    "title": "Zestawy: kod katalogowy (np. ZST-0001) i powiazanie z BaseLinkerem (meta: blId, blActive).",
    "tables": [],
    "columns": [
      "kits.code",
      "kits.meta"
    ],
    "functions": []
  },
  {
    "file": "migration-ops-customers.sql",
    "title": "Operacje: wspolna baza kontrahentow/klientow z WAPRO.",
    "tables": [
      "ops_customers"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-product-collections.sql",
    "title": "Foldery robocze (zbiory produktów pod tagi sklepu, zdjęcia itd.)",
    "tables": [
      "product_collections"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-product-meta.sql",
    "title": "Dodatkowe pola produktu (BaseLinker / oferta / AI) — elastyczny JSONB",
    "tables": [],
    "columns": [
      "products.product_meta"
    ],
    "functions": []
  },
  {
    "file": "migration-product-prices.sql",
    "title": "Ceny z WAPRO na produktach",
    "tables": [],
    "columns": [
      "products.price_purchase_net",
      "products.price_sale_net",
      "products.price_sale_gross"
    ],
    "functions": []
  },
  {
    "file": "migration-product-reserved.sql",
    "title": "Zarezerwowane sztuki produktu (R) — odczyt z WAPRO przez agenta zamowien (co ~5 min)",
    "tables": [],
    "columns": [
      "products.stock_reserved"
    ],
    "functions": []
  },
  {
    "file": "migration-product-sync-changes.sql",
    "title": "Szczegółowy log zmian z syncu WAPRO — który produkt, które pole, stara i nowa",
    "tables": [
      "product_sync_changes"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-product-tags.sql",
    "title": "Tagi produktów (np. Sonax = dziedziczony katalog sonax.sklep.pl)",
    "tables": [],
    "columns": [
      "products.tags"
    ],
    "functions": []
  },
  {
    "file": "migration-product-tech.sql",
    "title": "Warstwa techniczna produktow (nyple, trojniki, kolanka, redukcje, dysze): typ, parametry, nazwa katalogowa, aliasy.",
    "tables": [
      "product_tech"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-product-wapro-sales-stats.sql",
    "title": "Cache statystyk sprzedaży WAPRO na produkcie (sync zbiorczy z Mag)",
    "tables": [],
    "columns": [
      "products.wapro_sales_stats",
      "products.wapro_sales_synced_at"
    ],
    "functions": []
  },
  {
    "file": "migration-promotions-channel.sql",
    "title": "Kanal kampanii promocyjnej: baselinker (sklep internetowy) albo internal (wewnetrzna: tylko katalog i etykiety)",
    "tables": [],
    "columns": [
      "promo_campaigns.channel"
    ],
    "functions": []
  },
  {
    "file": "migration-promotions.sql",
    "title": "Centrum promocji: kampanie cenowe (daty od-do) i ceny promocyjne produktow",
    "tables": [
      "promo_campaigns",
      "promo_items"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-sales-sync-requests.sql",
    "title": "Zlecenie zbiorczego sync sprzedaży WAPRO (jak stock_sync_requests)",
    "tables": [
      "sales_sync_requests"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-sku-per-catalog.sql",
    "title": "Uruchom w Supabase SQL Editor",
    "tables": [],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-stock-sync-catalog.sql",
    "title": "Zakres syncu WAPRO: accessories | shop | all (null = all dla starych zleceń)",
    "tables": [],
    "columns": [
      "stock_sync_requests.catalog"
    ],
    "functions": []
  },
  {
    "file": "migration-stock-sync-requests.sql",
    "title": "Zlecenia ręcznego syncu stanów WAPRO (przycisk w aplikacji)",
    "tables": [
      "stock_sync_requests"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-stock.sql",
    "title": "Uruchom w Supabase SQL Editor",
    "tables": [],
    "columns": [
      "products.stock",
      "products.stock_manual"
    ],
    "functions": []
  },
  {
    "file": "migration-system-alerts.sql",
    "title": "Alerty systemowe + historia dostepnosci agentow (Logi -> Status systemow)",
    "tables": [
      "system_alerts",
      "agent_uptime"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-system-status.sql",
    "title": "Status systemow i zdarzenia serwerowe (strona Logi -> Status systemow)",
    "tables": [
      "system_events",
      "agent_heartbeats"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-technical-library.sql",
    "title": "Uruchom w Supabase SQL Editor",
    "tables": [
      "technical_library_articles"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-user-avatars.sql",
    "title": "Globalne avatary użytkowników Talk/Katalog",
    "tables": [],
    "columns": [
      "profiles.avatar_url"
    ],
    "functions": []
  },
  {
    "file": "migration-user-cloud-platform.sql",
    "title": "Profil (avatar, preferencje), macierz ról, widoczność profili w zespole",
    "tables": [
      "app_role_matrix"
    ],
    "columns": [
      "profiles.avatar_url",
      "profiles.user_preferences"
    ],
    "functions": []
  },
  {
    "file": "migration-user-favorites-grants.sql",
    "title": "Uzupełnienie RLS / GRANT dla ulubionych (upsert w PostgREST)",
    "tables": [],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-user-favorites-repair.sql",
    "title": "Naprawa ulubionych gdy tabela istnieje, ale zapis/odczyt nadal pada (RLS / GRANT).",
    "tables": [],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-user-favorites.sql",
    "title": "Ulubione per użytkownik (Supabase Auth)",
    "tables": [
      "user_favorites"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-user-sync-all.sql",
    "title": "Pełna synchronizacja użytkownika: ulubione + foldery + lokalizacja",
    "tables": [
      "user_favorites",
      "product_collections"
    ],
    "columns": [
      "products.warehouse_location"
    ],
    "functions": []
  },
  {
    "file": "migration-user-sync-bundle.sql",
    "title": "Jednorazowo: ulubione + foldery + lokalizacja (Supabase SQL Editor → Run)",
    "tables": [],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-wapro-order-docs.sql",
    "title": "Numery dokumentow (WZ / faktura) powiazanych z ZO, odczytane z WAPRO przez agenta",
    "tables": [],
    "columns": [
      "wapro_order_requests.wapro_docs"
    ],
    "functions": []
  },
  {
    "file": "migration-wapro-order-requests.sql",
    "title": "Zlecenia utworzenia zamówienia ZO w WAPRO Mag (jak WFSync, ale z katalogu)",
    "tables": [
      "wapro_order_requests"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-wapro-order-seq.sql",
    "title": "Globalny numer kolejny zlecen WAPRO (do numeru zamowienia klienta: H + inicjal handlowca + inicjal firmy + 00001)",
    "tables": [],
    "columns": [
      "wapro_order_requests.seq"
    ],
    "functions": []
  },
  {
    "file": "migration-wapro-order-state.sql",
    "title": "Stan realizacji ZO odczytany z WAPRO (agent aktualizuje co ~10 min)",
    "tables": [],
    "columns": [
      "wapro_order_requests.wapro_state"
    ],
    "functions": []
  },
  {
    "file": "migration-wapro-sales-requests.sql",
    "title": "Statystyki sprzedaży WAPRO na żądanie (zakładka w podglądzie produktu)",
    "tables": [
      "wapro_sales_requests"
    ],
    "columns": [],
    "functions": []
  },
  {
    "file": "migration-warehouse-location.sql",
    "title": "Lokalizacja magazynowa na karcie produktu (wspólna dla zespołu)",
    "tables": [],
    "columns": [
      "products.warehouse_location"
    ],
    "functions": []
  }
];
