"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { TimeService } from "@/services/time-service";

/**
 * F10 — Server actions timer/timesheet (dipakai halaman freelancer/time).
 * Resolusi freelancer: `FreelancerProfile.id` bila ada, else `User.id`
 * (TimeEntry.freelancerId scalar — konsisten di semua action di sini).
 * Approval klien v1 tanpa gate peran (tombol di halaman freelancer);
 * gating magic-link klien = TODO iterasi berikut.
 */

// TODO(F10-iterasi): gate approve/reject via magic-link klien (reuse share-service);
// TODO(nav): tambah 1 baris "Waktu & Bon" di navInsights layout freelancer
// (di-skip agar tak konflik eksekutor paralel — halaman time/expenses mandiri).

type Db = {
  user: { findUnique(args: unknown): Promise<{ id: string } | null> };
  freelancerProfile: { findFirst(args: unknown): Promise<{ id: string } | null> };
};

async function freelancerKey(): Promise<string | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  const db = prisma as never as Db;
  const user = await db.user.findUnique({
    where: { clerkUserId: clerkUser.id },
    select: { id: true },
  });
  if (!user) return null;
  const profile = await db.freelancerProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  return profile?.id ?? user.id;
}

function fail(error: unknown, fallback: string) {
  return {
    success: false as const,
    error: error instanceof Error ? error.message : fallback,
  };
}

const PATH = "/freelancer/time";

export async function startTimerAction(formData: FormData) {
  const key = await freelancerKey();
  if (!key) return { success: false as const, error: "errors.auth.required" };
  try {
    const rate = String(formData.get("rate") ?? "").trim();
    const row = await new TimeService().startTimer({
      project_id: String(formData.get("project_id") ?? ""),
      freelancerId: key,
      taskId: (formData.get("taskId") as string) || null,
      rate: rate ? rate : null,
    });
    revalidatePath(PATH);
    return { success: true as const, id: row.id };
  } catch (error) {
    return fail(error, "errors.time.failed");
  }
}

export async function stopTimerAction(formData: FormData) {
  const key = await freelancerKey();
  if (!key) return { success: false as const, error: "errors.auth.required" };
  try {
    const rawMinutes = String(formData.get("minutes") ?? "").trim();
    const row = await new TimeService().stopTimer({
      freelancerId: key,
      entryId: (formData.get("entryId") as string) || undefined,
      minutes: rawMinutes ? Number(rawMinutes) : undefined,
    });
    revalidatePath(PATH);
    return { success: true as const, id: row.id, minutes: row.minutes };
  } catch (error) {
    return fail(error, "errors.time.failed");
  }
}

export async function manualTimeAction(formData: FormData) {
  const key = await freelancerKey();
  if (!key) return { success: false as const, error: "errors.auth.required" };
  try {
    const rate = String(formData.get("rate") ?? "").trim();
    const row = await new TimeService().manualEntry({
      project_id: String(formData.get("project_id") ?? ""),
      freelancerId: key,
      minutes: Number(formData.get("minutes")),
      taskId: (formData.get("taskId") as string) || null,
      rate: rate ? rate : null,
    });
    revalidatePath(PATH);
    return { success: true as const, id: row.id };
  } catch (error) {
    return fail(error, "errors.time.failed");
  }
}

export async function approveTimeAction(formData: FormData) {
  const key = await freelancerKey();
  if (!key) return { success: false as const, error: "errors.auth.required" };
  try {
    await new TimeService().approveTime(String(formData.get("id") ?? ""));
    revalidatePath(PATH);
    return { success: true as const };
  } catch (error) {
    return fail(error, "errors.time.failed");
  }
}

export async function rejectTimeAction(formData: FormData) {
  const key = await freelancerKey();
  if (!key) return { success: false as const, error: "errors.auth.required" };
  try {
    await new TimeService().rejectTime(String(formData.get("id") ?? ""));
    revalidatePath(PATH);
    return { success: true as const };
  } catch (error) {
    return fail(error, "errors.time.failed");
  }
}

export async function convertTimeAction(formData: FormData) {
  const key = await freelancerKey();
  if (!key) return { success: false as const, error: "errors.auth.required" };
  try {
    const projectId = String(formData.get("project_id") ?? "").trim();
    const res = await new TimeService().convertToInvoice({
      freelancerId: key,
      project_id: projectId || undefined,
    });
    revalidatePath(PATH);
    return {
      success: true as const,
      invoiceId: res.invoiceId,
      amount: res.amount.toString(),
    };
  } catch (error) {
    return fail(error, "errors.time.failed");
  }
}
