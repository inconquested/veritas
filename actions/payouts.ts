"use server";

import { randomUUID } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { PayoutService } from "@/services/payout-service";

/**
 * F4 — Server actions payout manual v1 (dipakai `components/payout-panel.tsx`).
 * Resolusi freelancer via sesi Clerk; idempotencyKey dibuat per request bila
 * client tidak mengirim (server selalu menjamin ada).
 */

async function freelancerIdForSession(): Promise<string | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  const profile = await (prisma as never as {
    freelancerProfile: {
      findFirst(args: unknown): Promise<{ id: string } | null>;
    };
  }).freelancerProfile.findFirst({
    where: { user: { clerkUserId: clerkUser.id } },
    select: { id: true },
  });
  return profile?.id ?? null;
}

export async function requestPayoutAction(raw: {
  amount: string;
  bank: string;
  accountNo: string;
  idempotencyKey?: string;
}) {
  const freelancerId = await freelancerIdForSession();
  if (!freelancerId) return { success: false as const, error: "errors.auth.required" };
  try {
    const row = await new PayoutService().requestPayout({
      freelancerId,
      amount: raw.amount,
      bank: raw.bank,
      accountNo: raw.accountNo,
      idempotencyKey: raw.idempotencyKey?.trim() || randomUUID(),
    });
    return { success: true as const, payout: { ...row, amount: row.amount.toString() } };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "errors.payout.failed",
    };
  }
}

export async function listPayoutsAction() {
  const freelancerId = await freelancerIdForSession();
  if (!freelancerId) return { success: false as const, error: "errors.auth.required" };
  try {
    const rows = await new PayoutService().listPayouts(freelancerId);
    return {
      success: true as const,
      payouts: rows.map((r) => ({ ...r, amount: r.amount.toString() })),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "errors.payout.failed",
    };
  }
}

/** Manual v1: penanda DONE/FAILED dilakukan dari dashboard yang sama. */
export async function markPayoutDoneAction(id: string, extRef?: string) {
  const freelancerId = await freelancerIdForSession();
  if (!freelancerId) return { success: false as const, error: "errors.auth.required" };
  try {
    const row = await new PayoutService().markDone(id, extRef);
    return { success: true as const, payout: { ...row, amount: row.amount.toString() } };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "errors.payout.failed",
    };
  }
}
