-- DIAGNOSTYKA (tylko odczyt) — jak WAPRO przechowuje zamowienia i jak je tworzy WFSync.
-- Uruchom w SSMS na serwerze WAPRO (po USE WAPRO). Wynik skopiuj/zapisz do pliku tekstowego
-- (Wyniki -> prawy przycisk -> "Zapisz wyniki jako..." albo Ctrl+A, Ctrl+C w siatce) i przekaz.
-- NIC tu nie zapisuje do bazy.

USE WAPRO;
GO
SET NOCOUNT ON;

PRINT '=== 1. Tabele zamowien ===';
SELECT name AS tabela FROM sys.tables
WHERE name LIKE '%ZAMOWIEN%' OR name LIKE '%ZAMOW%' ORDER BY name;

PRINT '=== 2. Procedury (zamowienia / pozycje) i ich parametry ===';
SELECT p.name AS procedura, par.parameter_id AS nr, par.name AS parametr,
       TYPE_NAME(par.user_type_id) AS typ, par.max_length, par.is_output AS wyjscie
FROM sys.procedures p
LEFT JOIN sys.parameters par ON par.object_id = p.object_id
WHERE p.name LIKE '%Zamowien%' OR p.name LIKE '%DodajPozycj%' OR p.name LIKE 'RM[_]Dodaj%'
ORDER BY p.name, par.parameter_id;

PRINT '=== 3. Kolumny tabeli ZAMOWIENIE i pozycji ===';
SELECT t.name AS tabela, c.column_id AS nr, c.name AS kolumna,
       TYPE_NAME(c.user_type_id) AS typ, c.max_length, c.is_nullable AS null_ok
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN ('ZAMOWIENIE', 'POZYCJA_ZAMOWIENIA', 'POZYCJA_ZAMOWIENIA_ODBIORCY')
ORDER BY t.name, c.column_id;

PRINT '=== 4. Ostatnie 5 zamowien (JSON — wszystkie kolumny) ===';
SELECT (SELECT TOP 5 * FROM dbo.ZAMOWIENIE ORDER BY 1 DESC FOR JSON PATH) AS ostatnie_zamowienia;

PRINT '=== 5. Ostatnie 12 pozycji zamowien (JSON) ===';
SELECT (SELECT TOP 12 * FROM dbo.POZYCJA_ZAMOWIENIA ORDER BY 1 DESC FOR JSON PATH) AS ostatnie_pozycje;

PRINT '=== 6. Tresc procedury tworzacej zamowienie (jesli nie jest zaszyfrowana) ===';
EXEC sp_helptext 'dbo.RM_DodajZamowienie_Server';
GO
EXEC sp_helptext 'dbo.RM_DodajPozycjeZamowienia_Server';
GO

PRINT '=== 7. Uzytkownicy, firmy, magazyny (identyfikatory do konfiguracji agenta) ===';
SELECT (SELECT TOP 30 * FROM dbo.UZYTKOWNIK FOR JSON PATH) AS uzytkownicy;
SELECT (SELECT TOP 10 * FROM dbo.FIRMA FOR JSON PATH) AS firmy;
SELECT (SELECT TOP 10 * FROM dbo.MAGAZYN FOR JSON PATH) AS magazyny;
GO

PRINT '=== 8. Zamowienie utworzone przez nasza wczesniejsza probe ("Katalog: ...") — dlaczego nie da sie usunac ===';
SELECT (
  SELECT TOP 5 z.*
  FROM dbo.ZAMOWIENIE z
  WHERE CONVERT(nvarchar(max), (SELECT z.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) LIKE '%Katalog: ADAMETAL%'
  FOR JSON PATH
) AS osierocone_zamowienie;
GO

PRINT '=== 9. Pozycje i zalezne rekordy tego zamowienia (liczba) ===';
SELECT z.ID_ZAMOWIENIA,
       (SELECT COUNT(*) FROM dbo.POZYCJA_ZAMOWIENIA p WHERE p.ID_ZAMOWIENIA = z.ID_ZAMOWIENIA) AS pozycji
FROM dbo.ZAMOWIENIE z
WHERE CONVERT(nvarchar(max), (SELECT z.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) LIKE '%Katalog: ADAMETAL%';
GO

PRINT '=== 10. Procedury usuwania / anulowania zamowien ===';
SELECT name AS procedura FROM sys.procedures
WHERE name LIKE '%Usun%Zamow%' OR name LIKE '%Zamow%Usun%' OR name LIKE '%Anul%Zamow%' OR name LIKE '%Zamow%Anul%'
ORDER BY name;
GO
