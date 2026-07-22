-- Rename the user-membership tier system from Category → Membership.
-- Naming was overloaded: "Category" also refers to task/policy
-- categorization, which is a separate domain. "Membership" states
-- the intent (a tier that gates which courses a member sees) more
-- clearly. TaskCategory / PolicyCategory are unrelated and untouched.
--
-- Postgres preserves FK constraints across RENAME COLUMN and RENAME
-- TABLE, so no drop-and-recreate is needed. Index names carry the
-- old table/column tokens; we rename those to match so future
-- introspection isn't confusing.

-- Junction table first — it holds the FK to categories.id, so we
-- rename its own column before the parent table is renamed. Doing
-- them in either order works in Postgres (FK constraints are
-- tracked by oid, not names), but this ordering keeps the mental
-- model clean.
ALTER TABLE "course_categories" RENAME COLUMN "category_id" TO "membership_id";
ALTER TABLE "course_categories" RENAME TO "course_memberships";

-- Users table FK column
ALTER TABLE "users" RENAME COLUMN "category_id" TO "membership_id";

-- Parent table
ALTER TABLE "categories" RENAME TO "memberships";

-- Rename indexes so they don't carry stale "category" tokens.
-- @@unique on name + slug produce two unique indexes; @@map didn't
-- change the auto-generated names, so they still read "categories_*".
ALTER INDEX "categories_name_key" RENAME TO "memberships_name_key";
ALTER INDEX "categories_slug_key" RENAME TO "memberships_slug_key";

-- Junction table indexes: the composite PK is auto-named after the
-- table, and there's a secondary index on category_id.
ALTER INDEX "course_categories_pkey" RENAME TO "course_memberships_pkey";
ALTER INDEX "course_categories_category_id_idx" RENAME TO "course_memberships_membership_id_idx";

-- Rename FK constraints for clarity in \d output.
ALTER TABLE "users"
  RENAME CONSTRAINT "users_category_id_fkey" TO "users_membership_id_fkey";
ALTER TABLE "course_memberships"
  RENAME CONSTRAINT "course_categories_course_id_fkey"
  TO "course_memberships_course_id_fkey";
ALTER TABLE "course_memberships"
  RENAME CONSTRAINT "course_categories_category_id_fkey"
  TO "course_memberships_membership_id_fkey";
