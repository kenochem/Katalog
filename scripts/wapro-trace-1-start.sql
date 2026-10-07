-- KROK 1/3: START nagrywania wywolan procedur zamowien w bazie WAPRO (tylko obserwacja, nic nie zmienia w danych).
-- Uruchom w SSMS polaczonym z serwerem SQL, na ktorym jest baza WAPRO (F5).
USE master;
GO
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
PRINT 'Nagrywanie WLACZONE. Teraz w WAPRO utworz i zatwierdz testowe ZO (2 pozycje), potem uruchom plik 2 (odczyt).';
GO
