-- Link attachments — a TaskAttachment row with a non-null
-- source_url is a bookmark to an external URL (Google Drive,
-- Frame.io, Figma, etc.) instead of storage bytes. path / size /
-- mime_type carry placeholder values ("" / 0 / "link/external")
-- for link rows so their columns stay NOT NULL without a wider
-- refactor.

ALTER TABLE "task_attachments" ADD COLUMN "source_url" TEXT;
