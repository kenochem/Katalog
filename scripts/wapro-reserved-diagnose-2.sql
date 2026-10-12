-- DIAGNOSTYKA 2 (tylko odczyt): czy ARTYKUL.ZAREZERWOWANO (to, co WAPRO utrzymuje) zgadza sie z sumami z otwartych ZO.
-- Uruchom w SSMS (baza WAPRO), otworz zakladke "Komunikaty", zaznacz calosc (Ctrl+A), skopiuj i wklej do rozmowy.
USE WAPRO;
GO
SET NOCOUNT ON;

PRINT '=== 1. Dwa produkty ze zrzutu: VIKA0042 (program: stan 7, zarezerwowane 1, dostepne 6) i ARO000012 ===';
DECLARE @s nvarchar(max);
SELECT @s = (
  SELECT a.INDEKS_KATALOGOWY + ' | mag ' + CAST(a.ID_MAGAZYNU AS varchar(5)) + ' | stan ' + CAST(a.STAN AS varchar(30))
         + ' | ARTYKUL.ZAREZERWOWANO ' + CAST(a.ZAREZERWOWANO AS varchar(30)) + ' | DO_REZERWACJI ' + CAST(a.DO_REZERWACJI AS varchar(30)) + CHAR(13) + CHAR(10)
  FROM dbo.ARTYKUL a WHERE a.INDEKS_KATALOGOWY IN ('VIKA0042', 'ARO000012') ORDER BY a.INDEKS_KATALOGOWY, a.ID_MAGAZYNU FOR XML PATH(''));
PRINT @s;

PRINT '=== 2. Porownanie ARTYKUL.ZAREZERWOWANO (suma po magazynach) z suma z otwartych ZO ===';
;WITH art AS (
  SELECT ID_ARTYKULU, ID_MAGAZYNU, INDEKS_KATALOGOWY, ISNULL(ZAREZERWOWANO, 0) AS rez FROM dbo.ARTYKUL
), zo AS (
  SELECT p.ID_ARTYKULU, SUM(p.ZAREZERWOWANO) AS rez_zo
  FROM dbo.POZYCJA_ZAMOWIENIA p JOIN dbo.ZAMOWIENIE z ON z.ID_ZAMOWIENIA = p.ID_ZAMOWIENIA
  WHERE ISNULL(z.STAN_REALIZ, 'N') <> 'Z' GROUP BY p.ID_ARTYKULU
), j AS (
  SELECT a.INDEKS_KATALOGOWY AS sku, SUM(a.rez) AS rez_artykul, SUM(ISNULL(zo.rez_zo, 0)) AS rez_zo
  FROM art a LEFT JOIN zo ON zo.ID_ARTYKULU = a.ID_ARTYKULU
  GROUP BY a.INDEKS_KATALOGOWY
)
SELECT @s = 'artykulow z rezerwacja w ARTYKUL: ' + CAST(SUM(CASE WHEN rez_artykul > 0 THEN 1 ELSE 0 END) AS varchar(10))
          + ' | z rezerwacja w ZO: ' + CAST(SUM(CASE WHEN rez_zo > 0 THEN 1 ELSE 0 END) AS varchar(10))
          + ' | suma ARTYKUL: ' + CAST(SUM(rez_artykul) AS varchar(30)) + ' | suma ZO: ' + CAST(SUM(rez_zo) AS varchar(30))
          + ' | roznych wartosci: ' + CAST(SUM(CASE WHEN ABS(rez_artykul - rez_zo) > 0.0001 THEN 1 ELSE 0 END) AS varchar(10))
FROM j;
PRINT @s;

PRINT '=== 3. Do 15 przykladow roznic (SKU | ARTYKUL | ZO) ===';
;WITH art AS (
  SELECT ID_ARTYKULU, INDEKS_KATALOGOWY, ISNULL(ZAREZERWOWANO, 0) AS rez FROM dbo.ARTYKUL
), zo AS (
  SELECT p.ID_ARTYKULU, SUM(p.ZAREZERWOWANO) AS rez_zo
  FROM dbo.POZYCJA_ZAMOWIENIA p JOIN dbo.ZAMOWIENIE z ON z.ID_ZAMOWIENIA = p.ID_ZAMOWIENIA
  WHERE ISNULL(z.STAN_REALIZ, 'N') <> 'Z' GROUP BY p.ID_ARTYKULU
), j AS (
  SELECT a.INDEKS_KATALOGOWY AS sku, SUM(a.rez) AS rez_artykul, SUM(ISNULL(zo.rez_zo, 0)) AS rez_zo
  FROM art a LEFT JOIN zo ON zo.ID_ARTYKULU = a.ID_ARTYKULU GROUP BY a.INDEKS_KATALOGOWY
)
SELECT @s = (SELECT TOP 15 sku + ' | ' + CAST(rez_artykul AS varchar(30)) + ' | ' + CAST(rez_zo AS varchar(30)) + CHAR(13) + CHAR(10)
             FROM j WHERE ABS(rez_artykul - rez_zo) > 0.0001 ORDER BY ABS(rez_artykul - rez_zo) DESC FOR XML PATH(''));
PRINT @s;
GO
