-- Jednorazowo: ukrycie uslug (kody zaczynajace sie od "USŁ" — w bazie zapisane jako "US£" lub "USŁ").
-- Dashboard -> SQL Editor -> Run
-- Ukrywa (product_meta.catalogHidden = true) — produkty zostaja w bazie i w syncu, znikaja z katalogu.
-- Cofniecie: sekcja na dole pliku.

-- Podglad (ile pozycji zostanie ukrytych):
select sku, name, (product_meta ->> 'catalogHidden') as hidden
from public.products
where sku ilike 'US£%' or sku ilike 'USŁ%'
order by sku;

-- Ukrycie:
update public.products
set product_meta = coalesce(product_meta, '{}'::jsonb) || jsonb_build_object(
  'catalogHidden', true,
  'catalogHiddenReason', 'Usługa — nie jest produktem katalogowym',
  'catalogHiddenAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
)
where (sku ilike 'US£%' or sku ilike 'USŁ%')
  and coalesce(product_meta ->> 'catalogHidden', 'false') <> 'true';

-- Cofniecie (przywrocenie widocznosci) — odkomentuj i uruchom:
-- update public.products
-- set product_meta = product_meta - 'catalogHidden' - 'catalogHiddenReason' - 'catalogHiddenAt'
-- where (sku ilike 'US£%' or sku ilike 'USŁ%')
--   and product_meta ->> 'catalogHiddenReason' = 'Usługa — nie jest produktem katalogowym';
