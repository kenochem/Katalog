-- Stany (+ opcjonalnie ceny) z WAPRO Mag → CSV dla Katalogu
-- Baza: WAPRO
--
-- Minimalny eksport (stany) — zawsze działa:
SELECT
  LTRIM(RTRIM(INDEKS_KATALOGOWY)) AS sku,
  CAST(SUM(COALESCE(STAN, 0)) AS DECIMAL(18, 3)) AS stock
FROM dbo.ARTYKUL
WHERE INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(INDEKS_KATALOGOWY))
ORDER BY sku;

-- Eksport ze stanem i cenami netto (odkomentuj i dostosuj nazwy kolumn cen
-- po sprawdzeniu: SELECT TOP 1 * FROM dbo.ARTYKUL)
--
-- SELECT
--   LTRIM(RTRIM(INDEKS_KATALOGOWY)) AS sku,
--   CAST(SUM(COALESCE(STAN, 0)) AS DECIMAL(18, 3)) AS stock,
--   CAST(MAX(CENA_ZAKUPU_NETTO) AS DECIMAL(18, 4)) AS price_purchase_net,
--   CAST(MAX(CENA_SPRZEDAZY_NETTO) AS DECIMAL(18, 4)) AS price_sale_net,
--   CAST(MAX(CENA_SPRZEDAZY_BRUTTO) AS DECIMAL(18, 4)) AS price_sale_gross
-- FROM dbo.ARTYKUL
-- WHERE INDEKS_KATALOGOWY IS NOT NULL
--   AND LTRIM(RTRIM(INDEKS_KATALOGOWY)) <> ''
-- GROUP BY LTRIM(RTRIM(INDEKS_KATALOGOWY))
-- ORDER BY sku;
