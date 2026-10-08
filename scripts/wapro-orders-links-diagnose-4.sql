-- DIAGNOSTYKA 4 (tylko odczyt): ktore tabele wskazuja na zrealizowane zamowienie (STAN_REALIZ = 'Z').
-- Uruchom w SSMS (baza WAPRO), otworz zakladke "Komunikaty", zaznacz calosc (Ctrl+A), skopiuj i wklej do rozmowy.
USE WAPRO;
GO
SET NOCOUNT ON;

DECLARE @zam numeric(9,0) = 200050;   -- zrealizowane ZO 011592/26 (z diagnostyki 2)

PRINT '=== Zamowienie ===';
SELECT CAST(ID_ZAMOWIENIA AS varchar(20)) + ' | ' + ISNULL(NUMER, '') + ' | stan ' + ISNULL(STAN_REALIZ, '') + ' | klient ' + ISNULL(NR_ZAMOWIENIA_KLIENTA, '') AS zam FROM dbo.ZAMOWIENIE WHERE ID_ZAMOWIENIA = @zam;

PRINT '=== Pozycje zamowienia ===';
SELECT CAST(ID_POZYCJI_ZAMOWIENIA AS varchar(20)) + ' | zam ' + CAST(ZAMOWIONO AS varchar(30)) + ' | zreal ' + CAST(ZREALIZOWANO AS varchar(30)) AS poz FROM dbo.POZYCJA_ZAMOWIENIA WHERE ID_ZAMOWIENIA = @zam;

PRINT '=== Tabele z wierszami dla tego zamowienia (po ID_ZAMOWIENIA / ID_POZYCJI_ZAMOWIENIA) ===';
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + N'
IF EXISTS (SELECT 1 FROM dbo.[' + t.name + N'] WHERE [' + c.name + N'] = ' +
  CASE WHEN c.name = 'ID_ZAMOWIENIA' THEN N'@zam'
       ELSE N'ANY (SELECT 0) AND 1=0' END + N') PRINT ''' + t.name + N'.' + c.name + N''';'
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name = 'ID_ZAMOWIENIA' AND t.name NOT IN ('ZAMOWIENIE', 'POZYCJA_ZAMOWIENIA');
-- (powyzsze: tylko tabele po ID_ZAMOWIENIA)
EXEC sp_executesql @sql, N'@zam numeric(9,0)', @zam = @zam;

DECLARE @sql2 nvarchar(max) = N'';
SELECT @sql2 = @sql2 + N'
IF EXISTS (SELECT 1 FROM dbo.[' + t.name + N'] WHERE [' + c.name + N'] IN (SELECT ID_POZYCJI_ZAMOWIENIA FROM dbo.POZYCJA_ZAMOWIENIA WHERE ID_ZAMOWIENIA = @zam)) PRINT ''' + t.name + N'.' + c.name + N' (po pozycji)'';'
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name IN ('ID_POZYCJI_ZAMOWIENIA', 'ID_POZ_ZAM') AND t.name NOT IN ('POZYCJA_ZAMOWIENIA');
EXEC sp_executesql @sql2, N'@zam numeric(9,0)', @zam = @zam;

PRINT '=== Kolumny POZYCJA_DOKUMENTU_MAGAZYNOWEGO ===';
DECLARE @s nvarchar(max);
SELECT @s = (SELECT c.name + '; ' FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO') ORDER BY c.column_id FOR XML PATH(''));
PRINT @s;

PRINT '=== Kolumny tabel o nazwie z ZAMOW / RO / REALIZ w DOKUMENT_MAGAZYNOWY i DOKUMENT_HANDLOWY ===';
SELECT @s = (SELECT t.name + '.' + c.name + '; ' FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
             WHERE t.name IN ('DOKUMENT_MAGAZYNOWY', 'DOKUMENT_HANDLOWY', 'POZYCJA_DOKUMENTU_MAGAZYNOWEGO', 'POZYCJA_DOKUMENTU_HANDLOWEGO')
               AND (c.name LIKE '%ZAM%' OR c.name LIKE '%REALIZ%' OR c.name LIKE '%_RO%') FOR XML PATH(''));
PRINT @s;
GO
