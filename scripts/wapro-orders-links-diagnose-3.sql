-- DIAGNOSTYKA 3 (tylko odczyt): numer dokumentu (WZ/FS) powiazanego z zamowieniem ZO.
-- Uruchom w SSMS (baza WAPRO), potem otworz zakladke "Komunikaty" (nie "Wyniki"), zaznacz calosc (Ctrl+A), skopiuj i wklej do rozmowy.
USE WAPRO;
GO
SET NOCOUNT ON;

PRINT '=== A. Kolumny DOKUMENT_MAGAZYNOWY ===';
DECLARE @s nvarchar(max);
SELECT @s = (SELECT c.name + ' ' + TYPE_NAME(c.user_type_id) + '; ' FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.DOKUMENT_MAGAZYNOWY') ORDER BY c.column_id FOR XML PATH(''));
PRINT @s;

PRINT '=== B. Kolumny DOKUMENT_HANDLOWY ===';
SELECT @s = (SELECT c.name + ' ' + TYPE_NAME(c.user_type_id) + '; ' FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.DOKUMENT_HANDLOWY') ORDER BY c.column_id FOR XML PATH(''));
PRINT @s;

PRINT '=== C. Tabele z kolumna ID_POZ_DOK_MAG (wszystkie) ===';
SELECT @s = (SELECT t.name + '; ' FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id WHERE c.name = 'ID_POZ_DOK_MAG' ORDER BY t.name FOR XML PATH(''));
PRINT @s;

PRINT '=== D. Tabele o nazwie POZYCJA*MAG* ===';
SELECT @s = (SELECT name + '; ' FROM sys.tables WHERE name LIKE 'POZYCJA%MAG%' OR name LIKE 'POZ%DOK%MAG%' ORDER BY name FOR XML PATH(''));
PRINT @s;

PRINT '=== E. Ostatnie 6 powiazan (TABELA_POWIAZAN_ZAMOWIEN) z numerami ZO ===';
SELECT @s = (
  SELECT TOP 6 CAST(tp.ID_POZ_DOK_MAG AS varchar(20)) + ' | poz.zam ' + CAST(tp.ID_POZYCJI_ZAMOWIENIA AS varchar(20)) +
         ' | zam ' + CAST(tp.ID_ZAMOWIENIA AS varchar(20)) + ' | ' + ISNULL(z.NUMER, '?') + ' | zreal ' + CAST(tp.ZREALIZOWANO AS varchar(20)) + CHAR(13) + CHAR(10)
  FROM dbo.TABELA_POWIAZAN_ZAMOWIEN tp LEFT JOIN dbo.ZAMOWIENIE z ON z.ID_ZAMOWIENIA = tp.ID_ZAMOWIENIA
  ORDER BY tp.ID_POZ_DOK_MAG DESC FOR XML PATH('')
);
PRINT @s;

PRINT '=== F. Zamowienia nasze (NR_ZAMOWIENIA_KLIENTA zaczyna sie od H) i ich stan ===';
SELECT @s = (
  SELECT TOP 10 CAST(ID_ZAMOWIENIA AS varchar(20)) + ' | ' + ISNULL(NUMER, '') + ' | ' + ISNULL(NR_ZAMOWIENIA_KLIENTA, '') + ' | stan ' + ISNULL(STAN_REALIZ, '') + CHAR(13) + CHAR(10)
  FROM dbo.ZAMOWIENIE WHERE NR_ZAMOWIENIA_KLIENTA LIKE 'H%' ORDER BY ID_ZAMOWIENIA DESC FOR XML PATH('')
);
PRINT @s;
GO
