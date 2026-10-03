"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { ExpenseService } from "@/services/expense-service";
import { MediaService } from "@/services/vendor/media/media-service";

/**
 * F10 — Server actions expense (dipakai halaman freelancer/expenses).
 * Foto bon diunggah via MediaService existing (Cloudinary) lalu URL-nya
 * wajib diteruskan ke `addExpense` — tanpa foto = ditolak service.
 */

const PATH = "/freelancer/expenses";

async function freelancerKey(): Promise<string | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  const db = prisma as never as {
    user: { findUnique(args: unknown): Promise<{ id: string } | null> };
    freelancerProfile: { findFirst(args: unknown): Promise<{ id: string } | null> };
  };
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

export async function addExpenseAction(formData: FormData) {
  const key = await freelancerKey();
  if (!key) return { success: false as const, error: "errors.auth.required" };
  try {
    const file = formData.get("receipt");
    let receiptUrl = String(formData.get("receiptUrl") ?? "").trim();
    if (!receiptUrl && file instanceof File && file.size > 0) {
      receiptUrl = await new MediaService().uploadMediaSingle(file);
    }
    const row = await new ExpenseService().addExpense({
      freelancerId: key,
      label: String(formData.get("label") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      date: (formData.get("date") as string) || undefined,
      receiptUrl: receiptUrl || null,
      project_id: (formData.get("project_id") as string) || null,
      category: (formData.get("category") as string) || null,
    });
    revalidatePath(PATH);
    return { success: true as const, id: row.id };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "errors.expense.failed",
    };
  }
}
