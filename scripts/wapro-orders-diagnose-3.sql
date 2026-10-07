-- DIAGNOSTYKA 3 (tylko odczyt): jednostki, widok artykulow, stawki VAT — do budowy pozycji zamowienia.
--   sqlcmd -S localhost -d WAPRO -E -i "C:\katalog-sync\wapro-orders-diagnose-3.sql" -o "C:\katalog-sync\orders-diagnose-3.txt" -y 0 -f 65001
SET NOCOUNT ON;
USE WAPRO;
GO
PRINT '=== A. Kolumny JEDNOSTKA ===';
SELECT c.column_id AS nr, c.name AS kolumna, TYPE_NAME(c.user_type_id) AS typ, c.max_length
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.JEDNOSTKA') ORDER BY c.column_id;

PRINT '=== B. JEDNOSTKA — przyklad (10 wierszy) ===';
SELECT (SELECT TOP 10 * FROM dbo.JEDNOSTKA ORDER BY 1 FOR JSON PATH) AS jednostki;

PRINT '=== C. Kolumny WIDOK_ARTYKUL ===';
SELECT c.column_id AS nr, c.name AS kolumna, TYPE_NAME(c.user_type_id) AS typ, c.max_length
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.WIDOK_ARTYKUL') ORDER BY c.column_id;

PRINT '=== D. Artykul 4727 w WIDOK_ARTYKUL ===';
SELECT (SELECT * FROM dbo.WIDOK_ARTYKUL WHERE ID_ARTYKULU = 4727 FOR JSON PATH) AS widok_artykulu;

PRINT '=== E. Stawki VAT ===';
SELECT (SELECT TOP 15 * FROM dbo.STAWKA_VAT FOR JSON PATH) AS stawki_vat;
GO
