import { Hono } from "hono";
import { validator } from "hono/validator";
import { invoiceService } from "@/services/invoice-service";
import {
  ChargeInvoiceSchema,
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
} from "@/schemas";
import { formatZodIssues, toJsonSafe } from "@/lib/utils";

const invoicesApp = new Hono({ strict: false });

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
      const payload = c.req.valid("json");
      const invoice = await invoiceService.createInvoice(payload);
      return c.json({ success: true, data: toJsonSafe(invoice) }, 201);
    } catch (error) {
      return c.json(
        {
          success: false,
          errorKey: "errors.invoice.creation_failed",
        },
        400,
      );
    }
  },
);

invoicesApp.get("/", async (c) => {
  try {
    const projectId = c.req.query("projectId");
    const limit = Number(c.req.query("limit") ?? 10);
    const invoices = projectId
      ? await invoiceService.getProjectInvoices(projectId)
      : await invoiceService.getInvoices(limit);
    return c.json({ success: true, data: toJsonSafe(invoices) });
  } catch (error) {
    return c.json(
      {
        success: false,
        errorKey: "errors.invoices.fetch_failed",
      },
      500,
    );
  }
});

invoicesApp.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const invoice = await invoiceService.getInvoice(id);
    return c.json({ success: true, data: toJsonSafe(invoice) });
  } catch (error) {
    return c.json(
      {
        success: false,
        errorKey: "errors.notExist",
      },
      404,
    );
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
      const payload = c.req.valid("json");
      const updatedInvoice = await invoiceService.updateInvoice(id, payload);
      return c.json({ success: true, data: toJsonSafe(updatedInvoice) });
    } catch (error) {
      return c.json(
        {
          success: false,
          errorKey: "errors.invoice.update_failed",
        },
        400,
      );
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
      const payload = c.req.valid("json");
      const paymentResult = await invoiceService.chargeInvoice({
        ...payload,
        id,
      } as any);

      return c.json(
        {
          success: paymentResult.success,
          data: paymentResult,
        },
        paymentResult.success ? 200 : 400,
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          errorKey: "errors.invoice.charge_failed",
        },
        400,
      );
    }
  },
);

invoicesApp.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const deleted = await invoiceService.deleteInvoice(id);
    return c.json({ success: deleted });
  } catch (error) {
    return c.json(
      {
        success: false,
        errorKey: "errors.invoice.delete_failed",
      },
      400,
    );
  }
});

export { invoicesApp };
