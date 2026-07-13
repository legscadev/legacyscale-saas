// Scope helpers for the hierarchical `settings` table.
//
// Postgres treats NULL as distinct on unique constraints, which would
// let two PLATFORM rows share the same key. To keep `(scope,
// scope_id, key)` reliably unique across all Postgres versions, we
// use a sentinel UUID for the scope_id of PLATFORM rows instead of
// NULL. Callers should always route platform-level lookups through
// `PLATFORM_SCOPE_ID` so the constant stays authoritative.

/**
 * Fixed scope_id used for every PLATFORM-scoped Setting row. The
 * zero-UUID is chosen so it can never collide with a real Company or
 * User id (both minted via gen_random_uuid()).
 */
export const PLATFORM_SCOPE_ID = '00000000-0000-0000-0000-000000000000'
