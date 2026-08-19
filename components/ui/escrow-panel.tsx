"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, HandCoins, AlertTriangle, Undo2, Lock } from "lucide-react";
import { escrowAction, initializeEscrow } from "@/actions/escrow";
import { getActionErrorMessage } from "@/lib/utils";
import type { EscrowManualAction } from "@/schemas";

type EscrowState =
  | "INITIALIZED"
  | "FUNDS_HELD"
  | "DISPUTED"
  | "RELEASED"
  | "REFUNDED";

type Role = "CLIENT" | "FREELANCER";

// Display label text is resolved via t(`status.${code}`); only className is kept here.
const LABEL: Record<EscrowState, { className: string }> = {
  INITIALIZED: { className: "bg-muted text-muted-foreground border-border" },
  FUNDS_HELD: { className: "bg-blue-500/10 text-blue-600 border-blue-200" },
  DISPUTED: { className: "bg-amber-500/10 text-amber-600 border-amber-200" },
  RELEASED: { className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  REFUNDED: { className: "bg-purple-500/10 text-purple-600 border-purple-200" },
};

// Which manual actions each role may take from each state. Mirrors the server
// state machine; the server re-validates, this only shapes the UI.
const ALLOWED: Record<Role, Partial<Record<EscrowState, EscrowManualAction[]>>> = {
  CLIENT: {
    FUNDS_HELD: ["release", "dispute"],
    DISPUTED: ["release"],
  },
  FREELANCER: {
    FUNDS_HELD: ["dispute"],
    DISPUTED: ["refund"],
  },
};

// Display label is resolved via t(`action.${action}.label`); only icon/variant kept here.
const ACTION_META: Record<
  EscrowManualAction,
  { icon: React.ReactNode; variant: "default" | "outline" | "destructive" }
> = {
  release: { icon: <HandCoins className="h-4 w-4" />, variant: "default" },
  dispute: { icon: <AlertTriangle className="h-4 w-4" />, variant: "outline" },
  refund: { icon: <Undo2 className="h-4 w-4" />, variant: "destructive" },
};

export default function EscrowPanel({
  invoiceId,
  role,
  state,
}: {
  invoiceId: string;
  role: Role;
  state: EscrowState | null;
}) {
  const t = useTranslations("escrow");
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function run(fn: () => Promise<{ success: boolean; message?: string; errorKey?: string }>, key: string) {
    setPending(key);
    try {
      const result = await fn();
      if (!result.success) {
        toast.error(getActionErrorMessage(result, t("actionFailed")));
        return;
      }
      toast.success(t("updated"));
      router.refresh();
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setPending(null);
    }
  }

  const status = state ? LABEL[state] : null;
  const actions = state ? ALLOWED[role][state] ?? [] : [];

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {t("title")}
        </CardTitle>
        {state && status ? (
          <Badge variant="outline" className={`px-3 py-1 text-sm ${status.className}`}>
            {t(`status.${state}`)}
          </Badge>
        ) : (
          <Badge variant="outline" className="px-3 py-1 text-sm">
            {t("notStarted")}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>

        {!state ? (
          role === "CLIENT" || role === "FREELANCER" ? (
            <Button
              size="sm"
              disabled={pending !== null}
              onClick={() => run(() => initializeEscrow(invoiceId), "init")}
            >
              <Lock className="h-4 w-4" />
              {pending === "init" ? t("opening") : t("open")}
            </Button>
          ) : null
        ) : actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => {
              const meta = ACTION_META[action];
              return (
                <Button
                  key={action}
                  size="sm"
                  variant={meta.variant}
                  disabled={pending !== null}
                  onClick={() => run(() => escrowAction(action, invoiceId), action)}
                >
                  {meta.icon}
                  {pending === action ? t("working") : t(`action.${action}.label`)}
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t.rich("noActions", {
              state: state ? t(`status.${state}`) : "",
              strong: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
