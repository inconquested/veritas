"use server";

import { currentUser } from "@clerk/nextjs/server";
import { invoiceService } from "@/services/invoice-service";
import { shareService, SHARE_NOT_FOUND } from "@/services/share-service";
import {
  buildInvoiceHtml,
  buildReceiptHtml,
  invoiceFileName,
  type InvoicePdfData,
} from "@/lib/invoice-pdf";

/**
 * F4 — HTML invoice/kwitansi untuk `components/invoice-pdf-button.tsx`.
 * Di portal publik otorisasi = token magic-link; di dashboard = sesi Clerk.
 * Field F4 (number/type) dibaca defensif agar tetap jalan sebelum migrate.
 */
export async function getInvoicePdfHtml(
  invoiceId: string,
  opts: { token?: string; kind?: "invoice" | "kwitansi" } = {},
) {
  const kind = opts.kind ?? "invoice";
  try {
    if (opts.token) {
      try {
        await shareService.getProjectByToken(opts.token);
      } catch {
        return { success: false as const, error: SHARE_NOT_FOUND };
      }
    } else {
      const clerkUser = await currentUser();
      if (!clerkUser) return { success: false as const, error: "errors.auth.required" };
    }

    const invoice = (await invoiceService.getInvoice(invoiceId)) as Record<string, unknown>;
    const amount = invoice.amount as bigint;
    const data: InvoicePdfData = {
      number: (invoice.number as string | null) ?? null,
      type: (invoice.type as string | null) ?? "FINAL",
      title: String(invoice.title ?? "Invoice"),
      clientName: String(
        (invoice as { clientName?: unknown }).clientName ?? "Klien",
      ),
      amount,
      currency: (invoice.currency as string) ?? "IDR",
      dueDate: invoice.due_date as Date,
      issuedAt: (invoice.createdAt as Date) ?? new Date(),
      notes: (invoice.notes as string | null) ?? null,
      verifyUrl: opts.token ? `/p/${opts.token}` : null,
    };
    const html = kind === "kwitansi" ? buildReceiptHtml(data) : buildInvoiceHtml(data);
    return {
      success: true as const,
      html,
      fileName: invoiceFileName(data, kind),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "errors.internal",
    };
  }
}
