-- KROK 2/3: ODCZYT nagranych wywolan (sesja musi byc jeszcze wlaczona). Uruchom PO utworzeniu testowego ZO w WAPRO.
-- Najlepiej przez sqlcmd do pliku (bez obcinania):
--   sqlcmd -S localhost -d master -E -i "C:\katalog-sync\wapro-trace-2-read.sql" -o "C:\katalog-sync\orders-trace.txt" -y 0 -f 65001
SET NOCOUNT ON;
SELECT x.value('@timestamp', 'datetime2')                                     AS czas,
       x.value('(action[@name="username"]/value)[1]', 'nvarchar(100)')        AS uzytkownik,
       x.value('(action[@name="client_app_name"]/value)[1]', 'nvarchar(200)') AS aplikacja,
       x.value('(data[@name="object_name"]/value)[1]', 'nvarchar(200)')       AS procedura,
       x.value('(data[@name="statement"]/value)[1]', 'nvarchar(max)')         AS wywolanie,
       x.value('(data[@name="batch_text"]/value)[1]', 'nvarchar(max)')        AS batch
FROM (
  SELECT CAST(t.target_data AS xml) AS d
  FROM sys.dm_xe_session_targets t
  JOIN sys.dm_xe_sessions s ON s.address = t.event_session_address
  WHERE s.name = N'kenochem_zo_trace' AND t.target_name = N'ring_buffer'
) q
CROSS APPLY d.nodes('//RingBufferTarget/event') n(x)
ORDER BY czas;
GO
