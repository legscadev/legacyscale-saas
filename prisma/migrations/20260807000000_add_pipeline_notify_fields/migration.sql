-- Per-pipeline lead-notification recipients (email now, phone for SMS phase).
ALTER TABLE "crm_pipelines" ADD COLUMN "notify_email" TEXT;
ALTER TABLE "crm_pipelines" ADD COLUMN "notify_phone" TEXT;
