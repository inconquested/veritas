"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { chargeInvoice } from "@/actions/invoices";
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
  fieldErrors?: Record<string, string[]>;
};

const providerOptions = [
  { value: "STRIPE", label: "Stripe Checkout" },
  { value: "MIDTRANS", label: "Midtrans Snap" },
  { value: "XENDIT", label: "Xendit Invoice" },
  { value: "PAYPAL", label: "PayPal" },
] as const;

export default function ClientChargeDialog({
  invoiceId,
  amount,
  currency,
  method,
  disabled = false,
}: ChargeDialogProps) {
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

    const payload: Record<string, unknown> = {
      payment_method: provider,
    };

    if (destination.trim()) {
      payload.destination_account_id = destination.trim();
    }

    const result = await chargeInvoice(payload, invoiceId);
    const resultAny = result as any;

    if (!resultAny?.success) {
      const fieldErrors = (resultAny?.errors ?? {}) as Record<string, string[]>;
      const formError =
        resultAny?.data?.errorMessage ??
        resultAny?.errorKey ??
        "Unable to start payment flow.";
      setState({ formError, fieldErrors });
      setLoading(false);
      return;
    }

    const payment = (resultAny.data ?? {}) as Record<
      string,
      string | undefined
    >;
    const redirectUrl = payment.checkoutUrl ?? payment.redirectUrl;

    toast.success("Payment flow created");
    setOpen(false);
    router.refresh();

    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} size="lg" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Pay invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a payment route</DialogTitle>
          <DialogDescription>
            We&apos;ll launch the best checkout experience supported by the
            backend for this invoice: {amount} {currency}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="payment_method">Payment provider</FieldLabel>
              <FieldContent>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="payment_method">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Stripe works best for cards, while Xendit and Midtrans fit
                  localized hosted-payment flows.
                </FieldDescription>
                <FieldError
                  errors={state.fieldErrors?.payment_method?.map((message) => ({
                    message,
                  }))}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="destination_account_id">
                Destination account
              </FieldLabel>
              <FieldContent>
                <Input
                  id="destination_account_id"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="acct_freelancer_123"
                />
                <FieldDescription>
                  Optional. Pass through a connected account or payout
                  destination when your backend expects it.
                </FieldDescription>
                <FieldError
                  errors={state.fieldErrors?.destination_account_id?.map(
                    (message) => ({ message }),
                  )}
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          {state.formError ? (
            <Alert variant="destructive">
              <AlertTitle>Payment couldn&apos;t be started</AlertTitle>
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
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Preparing checkout…" : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
