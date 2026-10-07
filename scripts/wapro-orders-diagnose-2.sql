-- DIAGNOSTYKA 2 (tylko odczyt): kolumny potrzebne agentowi zamowien (artykul, kontrahent, VAT, jednostka, ceny).
-- Uruchom przez sqlcmd do pliku (bez obcinania), na serwerze WAPRO:
--   sqlcmd -S localhost -d WAPRO -E -i "C:\katalog-sync\wapro-orders-diagnose-2.sql" -o "C:\katalog-sync\orders-diagnose-2.txt" -y 0 -f 65001
-- Nie pobiera zadnych danych osobowych ani hasel (z kontrahenta tylko nazwy kolumn).
SET NOCOUNT ON;
USE WAPRO;
GO

PRINT '=== A. Kolumny ARTYKUL ===';
SELECT c.column_id AS nr, c.name AS kolumna, TYPE_NAME(c.user_type_id) AS typ, c.max_length
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.ARTYKUL') ORDER BY c.column_id;

PRINT '=== B. Kolumny KONTRAHENT (tylko nazwy) ===';
SELECT c.column_id AS nr, c.name AS kolumna, TYPE_NAME(c.user_type_id) AS typ, c.max_length
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.KONTRAHENT') ORDER BY c.column_id;

PRINT '=== C. Obiekty z kolumna CenaNettoSprzedazyDomyslna (widok cen uzywany przez sync) ===';
SELECT o.name AS obiekt, o.type_desc AS typ
FROM sys.columns c JOIN sys.objects o ON o.object_id = c.object_id
WHERE c.name IN ('CenaNettoSprzedazyDomyslna', 'CenaNettoZakupu', 'PromocyjnaCenaNetto');

PRINT '=== D. Tabele jednostek / VAT ===';
SELECT name AS tabela FROM sys.tables WHERE name LIKE '%JEDN%' OR name LIKE '%VAT%' ORDER BY name;

PRINT '=== E. Artykuly z testowego ZO (4727, 2928) — wszystkie wiersze (po magazynach) ===';
SELECT (SELECT * FROM dbo.ARTYKUL WHERE ID_ARTYKULU IN (4727, 2928) FOR JSON PATH) AS artykuly;

PRINT '=== F. Ten sam indeks w innych magazynach (ID_ARTYKULU per ID_MAGAZYNU) ===';
SELECT a.ID_ARTYKULU, a.ID_MAGAZYNU, a.INDEKS_KATALOGOWY
FROM dbo.ARTYKUL a
WHERE a.INDEKS_KATALOGOWY IN (SELECT INDEKS_KATALOGOWY FROM dbo.ARTYKUL WHERE ID_ARTYKULU IN (4727, 2928))
ORDER BY a.INDEKS_KATALOGOWY, a.ID_MAGAZYNU;

PRINT '=== G. Zamowienie testowe 200026 po zatwierdzeniu (naglowek + pozycje) ===';
SELECT (SELECT * FROM dbo.ZAMOWIENIE WHERE ID_ZAMOWIENIA = 200026 FOR JSON PATH) AS naglowek;
SELECT (SELECT * FROM dbo.POZYCJA_ZAMOWIENIA WHERE ID_ZAMOWIENIA = 200026 FOR JSON PATH) AS pozycje;
GO
