-- NAGRYWANIE wywolan procedur WAPRO przy tworzeniu zamowienia (Extended Events, tylko obserwacja).
-- Cel: zobaczyc DOKLADNE parametry, z jakimi WAPRO (albo WFSync) wola RM_DodajZamowienie_Server,
-- RM_DodajPozycjeZamowienia_Server, RM_SumujZamowienie_Server i RM_ZatwierdzZamowienie_Server.
--
-- UZYCIE (SSMS na serwerze WAPRO, po kolei):
--   KROK 1  Uruchom sekcje "START".
--   KROK 2  W programie WAPRO utworz JEDNO testowe zamowienie od odbiorcy (ZO): dowolny kontrahent,
--           2 pozycje (np. 1 szt. i 3 szt.), zatwierdz je jak zwykle (powstanie numer "ZO ...").
--           Najlepiej tez poczekaj, az WFSync przetworzy jedno zamowienie z BaseLinkera (jesli jest).
--   KROK 3  Uruchom sekcje "ODCZYT" (wynik zapisz do pliku, np. przez sqlcmd -y 0, tak jak poprzednio).
--   KROK 4  Uruchom sekcje "STOP".
-- Nagrywanie obejmuje tylko wywolania procedur *Zamowien* w bazie WAPRO i nic nie zmienia w danych.

USE master;
GO
-- ===== START =====
IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = N'kenochem_zo_trace')
  DROP EVENT SESSION kenochem_zo_trace ON SERVER;
GO
CREATE EVENT SESSION kenochem_zo_trace ON SERVER
ADD EVENT sqlserver.rpc_completed (
  ACTION (sqlserver.username, sqlserver.client_app_name, sqlserver.client_hostname)
  WHERE sqlserver.database_name = N'WAPRO'
    AND sqlserver.like_i_sql_unicode_string([object_name], N'%Zamowien%')
),
ADD EVENT sqlserver.sql_batch_completed (
  ACTION (sqlserver.username, sqlserver.client_app_name, sqlserver.client_hostname)
  WHERE sqlserver.database_name = N'WAPRO'
    AND sqlserver.like_i_sql_unicode_string([batch_text], N'%Zamowien%')
)
ADD TARGET package0.ring_buffer (SET max_memory = 51200)
WITH (MAX_DISPATCH_LATENCY = 1 SECONDS);
GO
ALTER EVENT SESSION kenochem_zo_trace ON SERVER STATE = START;
GO
PRINT 'Nagrywanie wlaczone — utworz teraz testowe ZO w WAPRO, potem uruchom sekcje ODCZYT.';
GO

/* ===== ODCZYT (uruchom po utworzeniu zamowienia; sesja musi byc jeszcze wlaczona) =====
SELECT x.value('@timestamp', 'datetime2')                                   AS czas,
       x.value('(action[@name="username"]/value)[1]', 'nvarchar(100)')      AS uzytkownik,
       x.value('(action[@name="client_app_name"]/value)[1]', 'nvarchar(200)') AS aplikacja,
       x.value('(data[@name="object_name"]/value)[1]', 'nvarchar(200)')     AS procedura,
       x.value('(data[@name="statement"]/value)[1]', 'nvarchar(max)')       AS wywolanie,
       x.value('(data[@name="batch_text"]/value)[1]', 'nvarchar(max)')      AS batch
FROM (
  SELECT CAST(t.target_data AS xml) AS d
  FROM sys.dm_xe_session_targets t
  JOIN sys.dm_xe_sessions s ON s.address = t.event_session_address
  WHERE s.name = N'kenochem_zo_trace' AND t.target_name = N'ring_buffer'
) q
CROSS APPLY d.nodes('//RingBufferTarget/event') n(x)
ORDER BY czas;
*/

/* ===== STOP (na koncu) =====
ALTER EVENT SESSION kenochem_zo_trace ON SERVER STATE = STOP;
DROP EVENT SESSION kenochem_zo_trace ON SERVER;
*/
