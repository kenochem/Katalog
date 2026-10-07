-- KROK 3/3: STOP i usuniecie sesji nagrywania.
USE master;
GO
IF EXISTS (SELECT 1 FROM sys.dm_xe_sessions WHERE name = N'kenochem_zo_trace')
  ALTER EVENT SESSION kenochem_zo_trace ON SERVER STATE = STOP;
GO
IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = N'kenochem_zo_trace')
  DROP EVENT SESSION kenochem_zo_trace ON SERVER;
GO
PRINT 'Nagrywanie zatrzymane i usuniete.';
GO
