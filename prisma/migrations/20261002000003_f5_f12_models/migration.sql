-- F5/F6/F9/F10/F11/F12 consolidator: 18 model baru + Handsout.status/version.
-- Manual migration (DB tidak reachable dari sini); cocok dengan prisma/schema.prisma.
-- Apply saat DB reachable: prisma migrate deploy (atau db push untuk dev).
-- Hanya Contract/Review yang pakai FK ke Project (1-1, project_id unique);
-- model lain sengaja tanpa FK (kolom String polos) agar tidak merusak relasi existing.

-- F5: approval handsout naikkan version.
ALTER TABLE "Handsout" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Handsout" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- ── F5 Proposal → Kontrak → Project ──
CREATE TABLE "Proposal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "freelancerId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "items" JSONB,
    "total" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(6),

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Proposal_freelancerId_idx" ON "Proposal"("freelancerId");
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

CREATE TABLE "Contract" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "freelancerSignedAt" TIMESTAMP(6),
    "clientSignedAt" TIMESTAMP(6),
    "bodyHash" TEXT,
    "pdfUrl" TEXT,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contract_project_id_key" ON "Contract"("project_id");

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Lead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "freelancerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "source" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'BARU',
    "notes" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_freelancerId_idx" ON "Lead"("freelancerId");
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- ── F6 Review + Retainer + Expense ──
CREATE TABLE "Review" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "verifiedAt" TIMESTAMP(6),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Review_project_id_key" ON "Review"("project_id");

ALTER TABLE "Review" ADD CONSTRAINT "Review_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Retainer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "monthlyFee" BIGINT NOT NULL,
    "nextRunAt" TIMESTAMP(6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Retainer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Retainer_project_id_idx" ON "Retainer"("project_id");
CREATE INDEX "Retainer_nextRunAt_idx" ON "Retainer"("nextRunAt");

CREATE TABLE "Expense" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "freelancerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" TIMESTAMP(6) NOT NULL,
    "receiptUrl" TEXT,
    "project_id" UUID,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_freelancerId_idx" ON "Expense"("freelancerId");
CREATE INDEX "Expense_project_id_idx" ON "Expense"("project_id");

-- ── F9 Kolaborasi & File ──
CREATE TABLE "Task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "milestone_id" UUID,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "assignee" TEXT,
    "due" TIMESTAMP(6),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_project_id_idx" ON "Task"("project_id");
CREATE INDEX "Task_milestone_id_idx" ON "Task"("milestone_id");
CREATE INDEX "Task_status_idx" ON "Task"("status");

CREATE TABLE "Attachment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parentType" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT,
    "uploader" TEXT,
    "note" TEXT,
    "url" TEXT NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_parentType_parentId_idx" ON "Attachment"("parentType", "parentId");

CREATE TABLE "ActivityEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityEvent_project_id_idx" ON "ActivityEvent"("project_id");

-- ── F10 Waktu ──
CREATE TABLE "TimeEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "taskId" UUID,
    "freelancerId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rate" BIGINT,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeEntry_project_id_idx" ON "TimeEntry"("project_id");
CREATE INDEX "TimeEntry_freelancerId_idx" ON "TimeEntry"("freelancerId");
CREATE INDEX "TimeEntry_status_idx" ON "TimeEntry"("status");

-- ── F11 Growth ──
CREATE TABLE "ServicePackage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "freelancerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServicePackage_freelancerId_idx" ON "ServicePackage"("freelancerId");

CREATE TABLE "Referral" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "converted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

CREATE TABLE "Coupon" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountOff" BIGINT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- ── F12 Ops Studio ──
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

CREATE TABLE "ClientCompany" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "billingContact" TEXT,

    CONSTRAINT "ClientCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'NORMAL',
    "slaDue" TIMESTAMP(6),
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Ticket_project_id_idx" ON "Ticket"("project_id");
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

CREATE TABLE "HandoverNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ALL',

    CONSTRAINT "HandoverNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HandoverNote_project_id_idx" ON "HandoverNote"("project_id");
