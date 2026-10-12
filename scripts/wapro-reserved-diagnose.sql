-- DIAGNOSTYKA (tylko odczyt): skad brac "zarezerwowane" (R) dla produktow w katalogu.
-- Uruchom w SSMS (baza WAPRO), otworz zakladke "Komunikaty", zaznacz calosc (Ctrl+A), skopiuj i wklej do rozmowy.
-- Podaj tez, co WAPRO pokazuje w programie dla jednego produktu (stan / zarezerwowane / dostepne) - SKU ponizej.
USE WAPRO;
GO
SET NOCOUNT ON;

DECLARE @sku varchar(40) = 'ARO000012';   -- zmien na SKU, ktory ma rezerwacje (zobacz w WAPRO: zakladka zamowienia)

PRINT '=== A. Kolumny ARTYKUL zwiazane ze stanem / rezerwacja ===';
DECLARE @s nvarchar(max);
SELECT @s = (SELECT c.name + ' ' + TYPE_NAME(c.user_type_id) + '; ' FROM sys.columns c
             WHERE c.object_id = OBJECT_ID('dbo.ARTYKUL') AND (c.name LIKE '%STAN%' OR c.name LIKE '%REZ%' OR c.name LIKE '%DOST%')
             ORDER BY c.column_id FOR XML PATH(''));
PRINT @s;

PRINT '=== B. Widoki / tabele o nazwach ze STAN lub REZERW ===';
SELECT @s = (SELECT name + '; ' FROM sys.objects WHERE type IN ('U','V') AND (name LIKE '%STAN%ARTYK%' OR name LIKE '%REZERW%' OR name LIKE 'WIDOK_STAN%') ORDER BY name FOR XML PATH(''));
PRINT @s;

PRINT '=== C. Wiersze ARTYKUL dla SKU (stan, rezerwacje) ===';
SELECT @s = (SELECT TOP 5 CAST(a.ID_ARTYKULU AS varchar(20)) + ' | mag ' + CAST(a.ID_MAGAZYNU AS varchar(10)) + ' | stan ' + CAST(a.STAN AS varchar(30)) + CHAR(13) + CHAR(10)
             FROM dbo.ARTYKUL a WHERE a.INDEKS_KATALOGOWY = @sku FOR XML PATH(''));
PRINT @s;

PRINT '=== D. Rezerwacje z otwartych zamowien (POZYCJA_ZAMOWIENIA) dla SKU ===';
SELECT @s = (
  SELECT TOP 20 z.NUMER + ' | stan_realiz ' + ISNULL(z.STAN_REALIZ,'') + ' | zam ' + CAST(p.ZAMOWIONO AS varchar(30)) + ' | zarezerw ' + CAST(p.ZAREZERWOWANO AS varchar(30))
         + ' | do_rez ' + CAST(p.DO_REZERWACJI AS varchar(30)) + ' | do_real ' + CAST(p.DO_REALIZACJI AS varchar(30)) + CHAR(13) + CHAR(10)
  FROM dbo.POZYCJA_ZAMOWIENIA p
  JOIN dbo.ZAMOWIENIE z ON z.ID_ZAMOWIENIA = p.ID_ZAMOWIENIA
  JOIN dbo.ARTYKUL a ON a.ID_ARTYKULU = p.ID_ARTYKULU
  WHERE a.INDEKS_KATALOGOWY = @sku AND ISNULL(z.STAN_REALIZ, 'N') <> 'Z'
  ORDER BY z.ID_ZAMOWIENIA DESC FOR XML PATH(''));
PRINT @s;

PRINT '=== E. Suma zarezerwowanych z otwartych zamowien dla SKU ===';
SELECT CAST(ISNULL(SUM(p.ZAREZERWOWANO), 0) AS varchar(30)) AS suma_zarezerwowano_ZO
FROM dbo.POZYCJA_ZAMOWIENIA p
JOIN dbo.ZAMOWIENIE z ON z.ID_ZAMOWIENIA = p.ID_ZAMOWIENIA
JOIN dbo.ARTYKUL a ON a.ID_ARTYKULU = p.ID_ARTYKULU
WHERE a.INDEKS_KATALOGOWY = @sku AND ISNULL(z.STAN_REALIZ, 'N') <> 'Z';

PRINT '=== F. Rezerwacje z dokumentow magazynowych (proformy / bufor) dla SKU: pozycje z ZAREZERWOWANO > 0 ===';
SELECT @s = (
  SELECT TOP 20 dm.NUMER + ' | rodzaj ' + ISNULL(dm.RODZAJ_DOKUMENTU,'') + ' | flaga ' + CAST(dm.FLAGA_STANU AS varchar(5)) + ' | zarezerw ' + CAST(pd.ZAREZERWOWANO AS varchar(30)) + CHAR(13) + CHAR(10)
  FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd
  JOIN dbo.DOKUMENT_MAGAZYNOWY dm ON dm.ID_DOK_MAGAZYNOWEGO = pd.ID_DOK_MAGAZYNOWEGO
  JOIN dbo.ARTYKUL a ON a.ID_ARTYKULU = pd.ID_ARTYKULU
  WHERE a.INDEKS_KATALOGOWY = @sku AND pd.ZAREZERWOWANO > 0
  FOR XML PATH(''));
PRINT @s;

PRINT '=== G. Ile artykulow ma jakakolwiek rezerwacje z ZO (skala zapytania zbiorczego) ===';
SELECT COUNT(DISTINCT p.ID_ARTYKULU) AS artykulow_z_rezerwacja, CAST(SUM(p.ZAREZERWOWANO) AS varchar(30)) AS suma
FROM dbo.POZYCJA_ZAMOWIENIA p
JOIN dbo.ZAMOWIENIE z ON z.ID_ZAMOWIENIA = p.ID_ZAMOWIENIA
WHERE p.ZAREZERWOWANO > 0 AND ISNULL(z.STAN_REALIZ, 'N') <> 'Z';
GO
