-- Production sheet — setter/closer daily numbers + monthly
-- targets + appointment log. Team-private by design; ADMIN
-- bypasses via a user picker in the UI. Modeled after the sales-
-- team Google Sheet that spawned this module.

CREATE TYPE "AppointmentStatus" AS ENUM (
  'PENDING',
  'SHOWED',
  'NO_SHOW',
  'CLOSED',
  'LOST'
);

-- One row per (user, calendar day). Every metric is nullable so
-- a fresh row can save with just a phone-calls number.
CREATE TABLE "production_entries" (
  "id"                TEXT NOT NULL,
  "user_id"           TEXT NOT NULL,
  "date"              DATE NOT NULL,
  "phone_calls"       INTEGER,
  "dms"               INTEGER,
  "cell_connects"     INTEGER,
  "appointments_set"  INTEGER,
  "demos_conducted"   INTEGER,
  "intro_units"       INTEGER,
  "basis_units"       INTEGER,
  "major_units"       INTEGER,
  "sales"             DECIMAL(12, 2),
  "collections"       DECIMAL(12, 2),
  "notes"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  "company_id"        TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "production_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "production_entries_user_id_date_company_id_key"
  ON "production_entries" ("user_id", "date", "company_id");
CREATE INDEX "production_entries_company_id_user_id_date_idx"
  ON "production_entries" ("company_id", "user_id", "date");

ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Monthly targets per user. Drives the "Monthly Targets /
-- Remaining / Days Left / Run Rate" summary row.
CREATE TABLE "production_targets" (
  "id"                TEXT NOT NULL,
  "user_id"           TEXT NOT NULL,
  "year"              INTEGER NOT NULL,
  "month"             INTEGER NOT NULL,
  "phone_calls"       INTEGER,
  "dms"               INTEGER,
  "cell_connects"     INTEGER,
  "appointments_set"  INTEGER,
  "demos_conducted"   INTEGER,
  "intro_units"       INTEGER,
  "basis_units"       INTEGER,
  "major_units"       INTEGER,
  "sales"             DECIMAL(12, 2),
  "collections"       DECIMAL(12, 2),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  "company_id"        TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "production_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "production_targets_user_id_year_month_company_id_key"
  ON "production_targets" ("user_id", "year", "month", "company_id");
CREATE INDEX "production_targets_company_id_user_id_year_month_idx"
  ON "production_targets" ("company_id", "user_id", "year", "month");

ALTER TABLE "production_targets" ADD CONSTRAINT "production_targets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Appointment log. `set_by_id` required (someone logged the row);
-- `closer_id` nullable while the deal is still in flight.
CREATE TABLE "appointment_sets" (
  "id"                 TEXT NOT NULL,
  "set_by_id"          TEXT NOT NULL,
  "closer_id"          TEXT,
  "prospect_name"      TEXT NOT NULL,
  "prospect_phone"     TEXT,
  "set_at"             DATE NOT NULL DEFAULT CURRENT_DATE,
  "appointment_at"     TIMESTAMP(3),
  "status"             "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
  "revenue_collected"  DECIMAL(12, 2),
  "immediate_amount"   DECIMAL(12, 2),
  "monthly_payment"    DECIMAL(12, 2),
  "funnel"             BOOLEAN,
  "notes"              TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  "company_id"         TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "appointment_sets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointment_sets_company_id_set_by_id_set_at_idx"
  ON "appointment_sets" ("company_id", "set_by_id", "set_at");
CREATE INDEX "appointment_sets_company_id_closer_id_appointment_at_idx"
  ON "appointment_sets" ("company_id", "closer_id", "appointment_at");
CREATE INDEX "appointment_sets_company_id_status_idx"
  ON "appointment_sets" ("company_id", "status");

ALTER TABLE "appointment_sets" ADD CONSTRAINT "appointment_sets_set_by_id_fkey"
  FOREIGN KEY ("set_by_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_sets" ADD CONSTRAINT "appointment_sets_closer_id_fkey"
  FOREIGN KEY ("closer_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
