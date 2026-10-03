-- F1 Magic-Link Client Portal: default access_key + revocable share tokens.
-- Manual migration (prisma migrate could not run against the DB here);
-- matches prisma/schema.prisma (Project.access_key default, ProjectShareToken).

-- Auto-fill access_key for new rows
ALTER TABLE "Project" ALTER COLUMN "access_key" SET DEFAULT gen_random_uuid();

-- Backfill rows created while createProject wrote access_key = ''
UPDATE "Project" SET "access_key" = gen_random_uuid()::text
WHERE "access_key" = '' OR "access_key" IS NULL;

-- Revocable per-link tokens (revoke = delete row; missing token => 404)
CREATE TABLE "ProjectShareToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "token" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "expiresAt" TIMESTAMP(6),
    "scope" VARCHAR(32) NOT NULL DEFAULT 'view',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectShareToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectShareToken_token_key" ON "ProjectShareToken"("token");
CREATE INDEX "ProjectShareToken_project_id_idx" ON "ProjectShareToken"("project_id");
CREATE INDEX "ProjectShareToken_token_idx" ON "ProjectShareToken"("token");

ALTER TABLE "ProjectShareToken" ADD CONSTRAINT "ProjectShareToken_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
