-- The `tls` column was introduced for Redis only. MySQL/MariaDB now honor it
-- as an explicit opt-out for servers that reject SSL handshakes. Backfill
-- existing MySQL/MariaDB connections to `tls = true` so they keep the
-- previous auto-TLS behavior for remote hosts (no silent downgrade).
UPDATE "Connection" SET "tls" = true WHERE "type" IN ('mysql', 'mariadb');
