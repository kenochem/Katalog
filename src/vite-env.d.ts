/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_PRODUCT?:
    | 'catalog'
    | 'suite'
    | 'sell'
    | 'stock'
    | 'ops'
    | 'talk'
    | 'logistics'
    | 'calendar';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
