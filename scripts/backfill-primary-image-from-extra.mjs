import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

if (!url || !key) {
  console.error('Brak SUPABASE_URL/VITE_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env');
  process.exit(1);
}

const supabase = createClient(url, key);
const products = [];
const page = 1000;

for (let from = 0; ; from += page) {
  const { data, error } = await supabase
    .from('products')
    .select('id,sku,display_name,image_url,custom_image_url,extra_images,has_image')
    .range(from, from + page - 1);
  if (error) throw error;
  if (!data?.length) break;
  products.push(...data);
  if (data.length < page) break;
}

const plan = products
  .filter((p) => {
    const extras = Array.isArray(p.extra_images) ? p.extra_images.filter(Boolean) : [];
    return !p.image_url && !p.custom_image_url && extras.length > 0;
  })
  .map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.display_name,
    imageUrl: p.extra_images[0],
  }));

console.log(`Produkty z extra_images bez miniatury glownej: ${plan.length}`);
for (const item of plan.slice(0, 40)) {
  console.log(`${item.sku}: ${item.name}`);
}

if (!APPLY) {
  console.log('Dry-run. Dodaj --apply zeby zapisac.');
  process.exit(0);
}

let updated = 0;
for (const item of plan) {
  const { error } = await supabase
    .from('products')
    .update({ image_url: item.imageUrl, has_image: true })
    .eq('id', item.id);
  if (error) throw new Error(`${item.sku}: ${error.message}`);
  updated += 1;
}

console.log(`Zaktualizowano: ${updated}`);
