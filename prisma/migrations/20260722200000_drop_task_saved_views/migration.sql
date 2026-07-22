-- Saved views moved to per-user localStorage on the client. The
-- server-backed table is no longer read or written, so we drop it.
-- CASCADE on the user FK already handled per-row cleanup on user
-- delete; dropping the whole table is the same story writ large.

DROP TABLE IF EXISTS "task_saved_views";
