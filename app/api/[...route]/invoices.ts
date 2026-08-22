import { Hono, type Context } from "hono";
import { validator } from "hono/validator";
import { invoiceService } from "@/services/invoice-service";
import {
  ChargeInvoiceSchema,
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
} from "@/schemas";
import { formatZodIssues, toJsonSafe } from "@/lib/utils";
import {
  authErrorResponse,
  invoiceScopeWhere,
  requireInvoiceAccess,
  requireProjectAccess,
  requireUser,
} from "@/services/auth-context";

const invoicesApp = new Hono({ strict: false });

function fail(c: Context, error: unknown, fallback: string, status = 400) {
  const auth = authErrorResponse(error);
  if (auth) return c.json(auth.body, auth.status as never);
  console.error(
    `Invoices API error [${fallback}]:`,
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  return c.json(
    { success: false, errorKey: fallback },
    status as never,
  );
}

invoicesApp.post(
  "/",
  validator("json", (value, c) => {
    const result = CreateInvoiceSchema.safeParse(value);
    if (!result.success) {
      return c.json(
        {
          success: false,
          errorKey: "errors.validation_failed",
          issues: formatZodIssues(result.error.issues),
        },
        400,
      );
    }
    return result.data;
  }),
  async (c) => {
    try {
      const user = await requireUser();
      const payload = c.req.valid("json");
      await requireProjectAccess(payload.project_id, user, "write");
      const invoice = await invoiceService.createInvoice(payload);
      return c.json({ success: true, data: toJsonSafe(invoice) }, 201);
    } catch (error) {
      return fail(c, error, "errors.invoice.creation_failed");
    }
  },
);

invoicesApp.get("/", async (c) => {
  try {
    const user = await requireUser();
    const projectId = c.req.query("projectId");
    const limit = Number(c.req.query("limit") ?? 10);
    const scope = invoiceScopeWhere(user);
    const invoices = projectId
      ? await invoiceService.getProjectInvoices(projectId, scope)
      : await invoiceService.getInvoices(limit, scope);
    return c.json({ success: true, data: toJsonSafe(invoices) });
  } catch (error) {
    return fail(c, error, "errors.invoices.fetch_failed", 500);
  }
});

invoicesApp.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const user = await requireUser();
    await requireInvoiceAccess(id, user, "read");
    const invoice = await invoiceService.getInvoice(id);
    return c.json({ success: true, data: toJsonSafe(invoice) });
  } catch (error) {
    return fail(c, error, "errors.notExist", 404);
  }
});

invoicesApp.put(
  "/:id",
  validator("json", (value, c) => {
    const result = UpdateInvoiceSchema.safeParse(value);
    if (!result.success) {
      return c.json(
        {
          success: false,
          errorKey: "errors.validation_failed",
          issues: formatZodIssues(result.error.issues),
        },
        400,
      );
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param("id");
    try {
      const user = await requireUser();
      await requireInvoiceAccess(id, user, "write");
      const payload = c.req.valid("json");
      const updatedInvoice = await invoiceService.updateInvoice(id, payload);
      return c.json({ success: true, data: toJsonSafe(updatedInvoice) });
    } catch (error) {
      return fail(c, error, "errors.invoice.update_failed");
    }
  },
);

invoicesApp.post(
  "/:id/charge",
  validator("json", (value, c) => {
    const result = ChargeInvoiceSchema.safeParse(value);
    if (!result.success) {
      return c.json(
        {
          success: false,
          errorKey: "errors.validation_failed",
          issues: formatZodIssues(result.error.issues),
        },
        400,
      );
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param("id");
    try {
      const user = await requireUser();
      await requireInvoiceAccess(id, user, "read");
      const payload = c.req.valid("json");
      const paymentResult = await invoiceService.chargeInvoice({
        ...payload,
        id,
      });

      return c.json(
        {
          success: paymentResult.success,
          data: paymentResult,
        },
        paymentResult.success ? 200 : 400,
      );
    } catch (error) {
      return fail(c, error, "errors.invoice.charge_failed");
    }
  },
);

invoicesApp.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const user = await requireUser();
    await requireInvoiceAccess(id, user, "write");
    const deleted = await invoiceService.deleteInvoice(id);
    return c.json({ success: deleted });
  } catch (error) {
    return fail(c, error, "errors.invoice.delete_failed");
  }
});

export { invoicesApp };
