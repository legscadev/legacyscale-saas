-- Add company_id to login_events so activity is tracked per-tenant.
-- Existing rows default to the platform company.

ALTER TABLE login_events
  ADD COLUMN company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE login_events
  ADD CONSTRAINT login_events_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX idx_login_events_company_user_login
  ON login_events (company_id, user_id, login_at);
