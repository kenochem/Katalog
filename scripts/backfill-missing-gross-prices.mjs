import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

if (!url || !key) {
  console.error('Brak SUPABASE_URL/VITE_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env');
  process.exit(1);
}

function grossFromNet(net, vatRate = 23) {
  const n = Number(net);
  const vat = Number(vatRate);
  if (!Number.isFinite(n)) return null;
  const rate = Number.isFinite(vat) && vat >= 0 ? vat : 23;
  return Math.round(n * (1 + rate / 100) * 100) / 100;
}

const supabase = createClient(url, key);
const products = [];
const page = 1000;

for (let from = 0; ; from += page) {
  const { data, error } = await supabase
    .from('products')
    .select('id,sku,display_name,price_sale_net,price_sale_gross,product_meta')
    .range(from, from + page - 1);
  if (error) throw error;
  if (!data?.length) break;
  products.push(...data);
  if (data.length < page) break;
}

const plan = products
  .filter((p) => p.price_sale_net != null && p.price_sale_gross == null)
  .map((p) => ({
    ...p,
    nextGross: grossFromNet(p.price_sale_net, p.product_meta?.vatRate ?? 23),
  }))
  .filter((p) => p.nextGross != null);

console.log(`Do uzupelnienia brutto: ${plan.length}`);
for (const item of plan.slice(0, 30)) {
  console.log(`${item.sku}: netto ${item.price_sale_net} -> brutto ${item.nextGross} | ${item.display_name}`);
}

if (!APPLY) {
  console.log('Dry-run. Dodaj --apply zeby zapisac.');
  process.exit(0);
}

let updated = 0;
for (const item of plan) {
  const { error } = await supabase
    .from('products')
    .update({ price_sale_gross: item.nextGross })
    .eq('id', item.id);
  if (error) throw new Error(`${item.sku}: ${error.message}`);
  updated += 1;
}

console.log(`Zaktualizowano: ${updated}`);
