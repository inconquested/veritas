/**
 * F8 AI — tombol "Terapkan jadi Milestone" untuk hasil brief generator.
 *
 * JANGAN ubah API existing: komponen ini hanya MEMANGGIL action
 * `updateProject` yang SUDAH ADA (mendukung `milestones` di UpdateProjectSchema).
 * TODO: ganti ke action create-milestone khusus bila sudah ada (milik F5/wave lain).
 */
"use client";

import * as React from "react";
import { updateProject } from "@/actions/projects";
import type { ProjectBrief } from "@/services/ai/brief-generator";

function briefToMilestonePayload(brief: ProjectBrief) {
  const now = Date.now();
  return brief.milestones.map((m) => ({
    title: m.title,
    description: m.description ?? null,
    // CreateProjectMilestoneSchema mewajibkan due_date → turunkan dari estimasi.
    due_date: new Date(
      now + (m.estimateDays && m.estimateDays > 0 ? m.estimateDays : 7) * 86_400_000,
    ).toISOString(),
  }));
}

export default function ApplyBriefButton({
  projectId,
  brief,
  onApplied,
}: {
  projectId: string;
  brief: ProjectBrief;
  onApplied?: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function apply() {
    setPending(true);
    setError(null);
    try {
      const res = (await updateProject(
        { milestones: briefToMilestonePayload(brief) },
        projectId,
      )) as { success?: boolean; errorKey?: string };
      if (!res?.success) {
        setError(res?.errorKey ?? "errors.project.update_failed");
        return;
      }
      setDone(true);
      onApplied?.();
    } catch {
      setError("errors.project.update_failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={apply}
        disabled={pending || done || brief.milestones.length === 0}
      >
        {done
          ? "Milestone diterapkan"
          : pending
            ? "Menerapkan…"
            : `Terapkan jadi Milestone (${brief.milestones.length})`}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
