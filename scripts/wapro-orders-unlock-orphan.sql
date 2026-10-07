-- Odblokowanie osieroconego zamowienia testowego 168662 ("Katalog: ADAMETAL ...", niebieski wiersz).
-- Zamowienie utworzyl nasz wczesniejszy szkic agenta z blednym uzytkownikiem (ID 1, nie istnieje):
-- ma SEMAFOR = 1 i FLAGA_STANU = 1 (edycja), wiec WAPRO uwaza je za otwarte przez kogos innego.
--
-- Skrypt dziala w TRANSAKCJI i domyslnie ja COFA (@zatwierdz = 0), zeby tylko pokazac efekt.
-- Gdy po wywolaniu SEMAFOR/ blokada znikna, ustaw @zatwierdz = 1 i uruchom ponownie.
-- Potem usun zamowienie zwyklym przyciskiem Usun w WAPRO.

USE WAPRO;
GO
SET NOCOUNT ON;
DECLARE @id numeric(9, 0) = 168662;
DECLARE @zatwierdz bit = 0;   -- <- zmien na 1 po sprawdzeniu

SELECT 'PRZED' AS etap, ID_ZAMOWIENIA, NUMER, SEMAFOR, FLAGA_STANU, DOK_ZABLOKOWANY, ID_UZYTKOWNIKA, DATA_BLOKADY_WIERSZA
FROM dbo.ZAMOWIENIE WHERE ID_ZAMOWIENIA = @id;

BEGIN TRAN;
  EXEC dbo.RM_UsunBlokadeZamowienia @ID_ZAMOWIENIA = @id, @Tryb = 0;

  SELECT 'PO' AS etap, ID_ZAMOWIENIA, NUMER, SEMAFOR, FLAGA_STANU, DOK_ZABLOKOWANY, ID_UZYTKOWNIKA, DATA_BLOKADY_WIERSZA
  FROM dbo.ZAMOWIENIE WHERE ID_ZAMOWIENIA = @id;

IF @zatwierdz = 1
BEGIN
  COMMIT;
  PRINT 'ZATWIERDZONO — odblokowanie zapisane. Usun zamowienie w WAPRO.';
END
ELSE
BEGIN
  ROLLBACK;
  PRINT 'COFNIETO (tryb podgladu). Ustaw @zatwierdz = 1, jesli wynik "PO" wyglada dobrze.';
END
GO
