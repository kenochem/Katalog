-- Usuwa z katalogu automatycznie zaimportowane szkielety WAPRO,
-- ktore w WAPRO sa oznaczone jako archiwalne przez "x" na poczatku SKU lub nazwy.
--
-- Najpierw uruchom SELECT i sprawdz liste.
-- DELETE uruchom dopiero po potwierdzeniu, ze pozycje faktycznie maja zniknac.

select id, sku, display_name, name, catalog, product_meta
from public.products
where product_meta ->> 'waproImport' = 'true'
  and product_meta ->> 'waproSkeleton' = 'true'
  and (
    lower(trim(coalesce(sku, ''))) like 'x%'
    or lower(trim(coalesce(name, ''))) like 'x%'
    or lower(trim(coalesce(display_name, ''))) like 'x%'
  )
order by sku;

-- DELETE:
delete from public.products
where product_meta ->> 'waproImport' = 'true'
  and product_meta ->> 'waproSkeleton' = 'true'
  and (
    lower(trim(coalesce(sku, ''))) like 'x%'
    or lower(trim(coalesce(name, ''))) like 'x%'
    or lower(trim(coalesce(display_name, ''))) like 'x%'
  );
