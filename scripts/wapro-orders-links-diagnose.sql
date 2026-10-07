-- DIAGNOSTYKA (tylko odczyt): jak WAPRO wiaze zamowienie ZO z dokumentami (FS/WZ) - do pokazania numeru faktury w CRM.
-- Uruchom w SSMS (USE WAPRO). Wynik skopiuj/zapisz do pliku i przekaz.
USE WAPRO;
GO
SET NOCOUNT ON;

PRINT '=== 1. Kolumny tabel powiazan ===';
SELECT t.name AS tabela, c.column_id AS nr, c.name AS kolumna, TYPE_NAME(c.user_type_id) AS typ
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN ('TABELA_POWIAZAN_ZAMOWIEN', 'ZAMOWIENIE_ZD_POWIAZANE_ZO')
ORDER BY t.name, c.column_id;

PRINT '=== 2. Ostatnie powiazania (JSON) ===';
SELECT (SELECT TOP 15 * FROM dbo.TABELA_POWIAZAN_ZAMOWIEN ORDER BY 1 DESC FOR JSON PATH) AS powiazania;

PRINT '=== 3. Zrealizowane zamowienia (pozycje ZREALIZOWANO > 0), ostatnie 8 ===';
SELECT (
  SELECT TOP 8 z.ID_ZAMOWIENIA, z.NUMER, z.STAN_REALIZ, z.STATUS_ZAM, z.NR_ZAMOWIENIA_KLIENTA
  FROM dbo.ZAMOWIENIE z
  WHERE EXISTS (SELECT 1 FROM dbo.POZYCJA_ZAMOWIENIA p WHERE p.ID_ZAMOWIENIA = z.ID_ZAMOWIENIA AND p.ZREALIZOWANO > 0)
  ORDER BY z.ID_ZAMOWIENIA DESC FOR JSON PATH
) AS zrealizowane;

PRINT '=== 4. Rozklad STAN_REALIZ / STATUS_ZAM ===';
SELECT STAN_REALIZ, STATUS_ZAM, COUNT(*) AS ile FROM dbo.ZAMOWIENIE GROUP BY STAN_REALIZ, STATUS_ZAM ORDER BY ile DESC;
GO
