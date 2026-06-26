-- AlterTable
ALTER TABLE "users" ADD COLUMN     "category_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
