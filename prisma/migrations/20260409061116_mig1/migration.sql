-- DropForeignKey
ALTER TABLE "public"."admin_sessions" DROP CONSTRAINT "admin_sessions_admin_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."attendance_entries" DROP CONSTRAINT "attendance_entries_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."project_entries" DROP CONSTRAINT "project_entries_user_id_fkey";

-- DropIndex
DROP INDEX "public"."idx_users_active";

-- AlterTable
ALTER TABLE "public"."project_entries" ALTER COLUMN "slot_index" SET DATA TYPE INTEGER;

-- AddForeignKey
ALTER TABLE "public"."attendance_entries" ADD CONSTRAINT "attendance_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_entries" ADD CONSTRAINT "project_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
