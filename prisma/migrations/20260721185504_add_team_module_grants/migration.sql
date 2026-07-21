-- CreateTable
CREATE TABLE "team_module_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "granted_by_id" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "team_module_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_module_grants_company_id_user_id_revoked_at_idx" ON "team_module_grants"("company_id", "user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "team_module_grants_company_id_module_key_idx" ON "team_module_grants"("company_id", "module_key");

-- AddForeignKey
ALTER TABLE "team_module_grants" ADD CONSTRAINT "team_module_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_module_grants" ADD CONSTRAINT "team_module_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_module_grants" ADD CONSTRAINT "team_module_grants_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
