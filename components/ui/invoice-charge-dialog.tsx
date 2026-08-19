"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { chargeInvoice } from "@/actions/invoices";
import { isTimeoutErrorKey } from "@/lib/action-timeout";
import { TIMEOUT_MESSAGE } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

type ChargeDialogProps = {
  invoiceId: string;
  amount: string;
  currency: string;
  method?: string;
  disabled?: boolean;
};

type ActionState = {
  formError?: string | null;
  fieldErrors?: Record<string, string>;
};

// Provider CODE values used for logic; display labels resolved via t(`provider.${value}`).
const providerOptions = ["STRIPE", "MIDTRANS", "XENDIT", "PAYPAL"] as const;

export default function ClientChargeDialog({
  invoiceId,
  amount,
  currency,
  method,
  disabled = false,
}: ChargeDialogProps) {
  const t = useTranslations("invoiceCharge");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [provider, setProvider] = React.useState(method ?? "STRIPE");
  const [destination, setDestination] = React.useState("");
  const [state, setState] = React.useState<ActionState>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setState({});

    try {
      const payload: Record<string, unknown> = {
        payment_method: provider,
      };

      if (destination.trim()) {
        payload.destination_account_id = destination.trim();
      }

      const result = await chargeInvoice(payload, invoiceId);
      const resultAny = result as any;

      if (!resultAny?.success) {
        const fieldErrors = (resultAny?.errors ?? {}) as Record<string, string>;
        const formError = isTimeoutErrorKey(resultAny?.errorKey)
          ? TIMEOUT_MESSAGE
          : resultAny?.data?.errorMessage ??
            resultAny?.errorKey ??
            t("startFailed");
        setState({ formError, fieldErrors });
        return;
      }

      const payment = (resultAny.data ?? {}) as Record<
        string,
        string | undefined
      >;
      const redirectUrl = payment.checkoutUrl ?? payment.redirectUrl;

      toast.success(t("paymentCreated"));
      setOpen(false);
      router.refresh();

      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
    } catch {
      setState({ formError: t("startFailed") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} size="lg" className="gap-2">
          <Sparkles className="h-4 w-4" />
          {t("payInvoice")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("dialogDescription", { amount, currency })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="payment_method">{t("providerLabel")}</FieldLabel>
              <FieldContent>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="payment_method">
                    <SelectValue placeholder={t("providerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`provider.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {t("providerDescription")}
                </FieldDescription>
                <FieldError
                  errors={state.fieldErrors?.payment_method
                    ? [{ message: state.fieldErrors.payment_method }]
                    : undefined}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="destination_account_id">
                {t("destinationLabel")}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="destination_account_id"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder={t("destinationPlaceholder")}
                />
                <FieldDescription>
                  {t("destinationDescription")}
                </FieldDescription>
                <FieldError
                  errors={state.fieldErrors?.destination_account_id
                    ? [{ message: state.fieldErrors.destination_account_id }]
                    : undefined}
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          {state.formError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("errorTitle")}</AlertTitle>
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("preparing") : t("continue")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
