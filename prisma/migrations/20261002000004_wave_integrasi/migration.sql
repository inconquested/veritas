-- Wave integrasi (pemilik schema wave ini): NotifyLog + FreelancerSetting +
-- kolom User.phone, FreelancerProfile bio/skills/hourlyRate/waNumber,
-- Project.workspaceId, Ticket.assignee.
-- Manual migration (DB tidak reachable dari sini); cocok dengan prisma/schema.prisma.
-- Apply saat DB reachable: prisma migrate deploy (atau db push untuk dev).

CREATE TABLE "NotifyLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "idempotencyKey" TEXT NOT NULL,
    "template" VARCHAR(64) NOT NULL,
    "sentAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotifyLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotifyLog_idempotencyKey_key" ON "NotifyLog"("idempotencyKey");
CREATE INDEX "NotifyLog_template_idx" ON "NotifyLog"("template");

CREATE TABLE "FreelancerSetting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "freelancerId" TEXT NOT NULL,
    "autoReleaseDays" INTEGER NOT NULL DEFAULT 14,
    "reminderChannel" VARCHAR(16) NOT NULL DEFAULT 'both',

    CONSTRAINT "FreelancerSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FreelancerSetting_freelancerId_key" ON "FreelancerSetting"("freelancerId");

ALTER TABLE "User" ADD COLUMN "phone" VARCHAR(32);
ALTER TABLE "FreelancerProfile" ADD COLUMN "bio" TEXT;
ALTER TABLE "FreelancerProfile" ADD COLUMN "skills" TEXT;
ALTER TABLE "FreelancerProfile" ADD COLUMN "hourlyRate" BIGINT;
ALTER TABLE "FreelancerProfile" ADD COLUMN "waNumber" VARCHAR(32);
ALTER TABLE "Project" ADD COLUMN "workspaceId" UUID;
ALTER TABLE "Ticket" ADD COLUMN "assignee" TEXT;
