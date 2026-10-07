-- DIAGNOSTYKA 2 (tylko odczyt): z jakiego dokumentu pochodzi realizacja zamowienia (WZ/FS) i jak go nazwac w CRM.
-- Uruchom w SSMS (USE WAPRO). Wynik (zrzut ekranu albo tekst) przekaz.
USE WAPRO;
GO
SET NOCOUNT ON;

PRINT '=== 1. Tabele z kolumna ID_POZ_DOK_MAG (pozycje dokumentow magazynowych) ===';
SELECT t.name AS tabela, c.name AS kolumna
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name = 'ID_POZ_DOK_MAG'
ORDER BY t.name;

PRINT '=== 2. Kolumny tabeli pozycji dok. mag. (szukamy ID_DOKUMENTU / numeru) ===';
SELECT t.name AS tabela, c.column_id AS nr, c.name AS kolumna, TYPE_NAME(c.user_type_id) AS typ
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN ('POZYCJA_DOK_MAG', 'DOKUMENT_MAGAZYNOWY', 'DOK_MAG', 'POZYCJA_DOKUMENTU_MAGAZYNOWEGO')
ORDER BY t.name, c.column_id;

PRINT '=== 3. Tabele o nazwach dokumentow handlowych / magazynowych ===';
SELECT name AS tabela FROM sys.tables
WHERE name LIKE '%DOK%' AND (name LIKE '%MAG%' OR name LIKE '%HAND%' OR name LIKE '%FAKT%')
ORDER BY name;

PRINT '=== 4. Przyklad: powiazanie zamowienia ZO 200050 -> pozycje dok. mag. (JSON) ===';
SELECT (
  SELECT TOP 10 tp.*
  FROM dbo.TABELA_POWIAZAN_ZAMOWIEN tp
  WHERE tp.ID_ZAMOWIENIA = 200050
  FOR JSON PATH
) AS powiazania_200050;
GO
