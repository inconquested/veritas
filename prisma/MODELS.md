# MODELS.md — indeks model F5/F6/F9/F10/F11/F12 (wave fitur)

Existing (tak diubah): User, Project (+`contract`, `review`), Milestone,
Invoice (+number/type), Escrow, EscrowEvent, Handsout (+`status` DRAFT,
+`version` 1), Comment, Dispute, ProjectShareToken, Payout.

Hanya Contract/Review relasi 1-1 ke Project. Sisanya kolom String polos
(tanpa @relation) agar relasi existing aman.

## F5 — Proposal → Kontrak
- Proposal: freelancerId, clientName, items Json?, total BigInt, status DRAFT, expiresAt?
- Contract: project_id @unique → Project, body, freelancerSignedAt?, clientSignedAt?, bodyHash?, pdfUrl?
- Lead: freelancerId, name, contact?, source?, stage BARU, notes?

## F6 — Review + Retainer + Expense
- Review: project_id @unique → Project, rating Int, text?, verifiedAt?
- Retainer: project_id, monthlyFee BigInt, nextRunAt, active true
- Expense: freelancerId, label, amount BigInt, date, receiptUrl?, project_id?

## F9 — Kolaborasi & File
- Task: project_id, milestone_id?, title, status TODO, assignee?, due?
- Attachment: parentType, parentId, version 1, hash?, uploader?, note?, url
- ActivityEvent: project_id, actorId?, action, metadata Json?, createdAt

## F10 — Waktu
- TimeEntry: project_id, taskId?, freelancerId, minutes Int, status DRAFT, rate BigInt?

## F11 — Growth
- ServicePackage: freelancerId, title, price BigInt, description?, active true
- Referral: code @unique, referrerId, converted false
- Coupon: code @unique, percentOff?, amountOff?, maxUses?, usedCount 0

## F12 — Ops Studio
- Workspace: name, plan FREE
- WorkspaceMember: workspaceId, userId, role STAFF
- ClientCompany: name, billingContact?
- Ticket: project_id, severity NORMAL, slaDue?, status OPEN
- HandoverNote: project_id, title, body, role ALL
