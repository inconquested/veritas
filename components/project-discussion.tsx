import prisma from "@/lib/prisma";
import { commentService } from "@/services/comment-service";
import { disputeService } from "@/services/dispute-service";
import { escrowService } from "@/services/escrow-service";
import { addCommentAction } from "@/actions/comments";
import {
  openDisputeAction,
  resolveDisputeAction,
  respondDisputeAction,
} from "@/actions/disputes";
import CommentThread, { type ThreadComment } from "./comment-thread";
import DisputePanel, { type DisputeDTO } from "./dispute-panel";
import EscrowTimeline from "./escrow-timeline";

const db = prisma as any;

function toThreadComment(row: any): ThreadComment {
  return {
    id: String(row.id),
    authorRole: String(row.authorRole ?? "?"),
    body: String(row.body ?? ""),
    attachments: Array.isArray(row.attachments) ? row.attachments.map(String) : [],
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt ?? ""),
  };
}

function toDisputeDTO(row: any): DisputeDTO {
  return {
    id: String(row.id),
    escrowId: String(row.escrowId),
    reason: String(row.reason ?? ""),
    requestedAmount:
      row.requestedAmount == null ? null : String(row.requestedAmount),
    status: String(row.status),
    deadlineAt:
      row.deadlineAt instanceof Date
        ? row.deadlineAt.toISOString()
        : String(row.deadlineAt ?? ""),
  };
}

/**
 * F2 discussion block untuk halaman project detail (freelancer dashboard).
 * Semua fetch dibungkus catch → [] supaya halaman tetap jalan sebelum
 * migration F2 di-apply (tabel Comment/Dispute belum ada = kosong).
 */
export default async function ProjectDiscussion({
  projectId,
}: {
  projectId: string;
}) {
  const [commentsRaw, milestones, handsouts, invoices] = await Promise.all([
    commentService.getComments(projectId).catch(() => []),
    db.milestone
      .findMany({
        where: { project_id: projectId },
        select: { id: true, title: true },
        orderBy: { due_date: "asc" },
      })
      .catch(() => []),
    db.handsout
      .findMany({
        where: { project_id: projectId },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    db.invoice
      .findMany({
        where: { project_id: projectId },
        select: {
          id: true,
          title: true,
          escrow: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
  ]);

  const escrowed = (invoices as any[]).filter((inv) => inv?.escrow?.id);
  const escrowIds = escrowed.map((inv) => String(inv.escrow.id));
  const [disputesRaw, eventsList] = await Promise.all([
    disputeService.listForEscrows(escrowIds).catch(() => []),
    Promise.all(
      escrowed.map((inv) =>
        escrowService.getEvents(String(inv.id)).catch(() => []),
      ),
    ),
  ]);
  const disputes = (disputesRaw as any[]).map(toDisputeDTO);
  const disputeByEscrow = new Map(disputes.map((d) => [d.escrowId, d]));

  const forScope = (key: "milestone_id" | "handsout_id", id: string) =>
    (commentsRaw as any[])
      .filter((r) => String(r[key] ?? "") === String(id))
      .map(toThreadComment);
  const general = (commentsRaw as any[])
    .filter((r) => !r.milestone_id && !r.handsout_id)
    .map(toThreadComment);

  return (
    <div className="space-y-4">
      <CommentThread
        projectId={projectId}
        title="Diskusi project (bukti tertulis)"
        comments={general}
        addAction={addCommentAction}
      />
      {(milestones as any[]).map((m: any) => (
        <CommentThread
          key={String(m.id)}
          projectId={projectId}
          milestoneId={String(m.id)}
          title={`Milestone: ${m.title}`}
          comments={forScope("milestone_id", String(m.id))}
          addAction={addCommentAction}
        />
      ))}
      {(handsouts as any[]).map((h: any) => (
        <CommentThread
          key={String(h.id)}
          projectId={projectId}
          handsoutId={String(h.id)}
          title={`Handsout: ${h.title}`}
          comments={forScope("handsout_id", String(h.id))}
          addAction={addCommentAction}
        />
      ))}
      {escrowed.map((inv: any, i: number) => {
        const invoiceId = String(inv.id);
        const escrowId = String(inv.escrow.id);
        return (
          <div key={invoiceId} className="space-y-4">
            <DisputePanel
              projectId={projectId}
              invoiceId={invoiceId}
              invoiceTitle={String(inv.title ?? "Invoice")}
              escrowId={escrowId}
              dispute={disputeByEscrow.get(escrowId) ?? null}
              openAction={openDisputeAction}
              respondAction={(id) => respondDisputeAction(id, projectId)}
              resolveAction={(id, outcome) =>
                resolveDisputeAction(id, projectId, invoiceId, outcome)
              }
            />
            {(eventsList[i] as any[])?.length > 0 ? (
              <EscrowTimeline events={eventsList[i] as never} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
