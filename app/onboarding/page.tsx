"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Briefcase,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { updateUserRole } from "@/actions/onboarding";
import { TIMEOUT_ERROR_KEY } from "@/lib/action-timeout";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Role = "client" | "freelancer";

const ROLES: {
  role: Role;
  icon: typeof Users;
  destination: string;
  benefitKeys: [string, string, string];
}[] = [
  {
    role: "client",
    icon: Users,
    destination: "/client/homepage",
    benefitKeys: ["clientBenefit1", "clientBenefit2", "clientBenefit3"],
  },
  {
    role: "freelancer",
    icon: Briefcase,
    destination: "/freelancer/dashboard",
    benefitKeys: [
      "freelancerBenefit1",
      "freelancerBenefit2",
      "freelancerBenefit3",
    ],
  },
];

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const { user } = useUser();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selectedRole || submitting) return;

    setSubmitting(true);
    setErrorKey(null);

    const result = await updateUserRole(selectedRole);

    if (!result.success) {
      setErrorKey(result.errorKey);
      setSubmitting(false);
      return;
    }

    // Refresh Clerk's cached user so the new role is visible before we route.
    await user?.reload();
    const destination =
      ROLES.find((option) => option.role === selectedRole)?.destination ?? "/";
    router.push(destination);
  };

  const errorMessage = errorKey
    ? errorKey === TIMEOUT_ERROR_KEY
      ? t("timeoutMessage")
      : t("errorMessage")
    : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,var(--primary)/12%,transparent_70%)]"
      />

      <div className="relative w-full max-w-4xl space-y-10">
        <div className="space-y-4 text-center">
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-primary"
          >
            <Sparkles className="size-3.5" />
            {t("badge")}
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            {t("welcome")} <span className="text-primary">Veritas</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {ROLES.map(({ role, icon: Icon, benefitKeys }) => {
            const isSelected = selectedRole === role;
            return (
              <Card
                key={role}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-disabled={submitting}
                onClick={() => {
                  if (submitting) return;
                  setSelectedRole(role);
                  setErrorKey(null);
                }}
                onKeyDown={(event) => {
                  if (submitting) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedRole(role);
                    setErrorKey(null);
                  }
                }}
                className={cn(
                  "cursor-pointer border shadow-sm transition-all outline-none",
                  "hover:border-primary/50 hover:shadow-md",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                    : "border-border",
                  submitting && !isSelected && "opacity-60",
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-7" />
                    </div>
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent",
                      )}
                    >
                      <Check className="size-4" />
                    </span>
                  </div>
                  <CardTitle className="mt-4 text-2xl">
                    {t(`${role}Title`)}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {t(`${role}Description`)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {benefitKeys.map((key) => (
                      <li
                        key={key}
                        className="flex items-center gap-2.5 text-sm text-muted-foreground"
                      >
                        <Check className="size-4 shrink-0 text-primary" />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {errorMessage ? (
          <Alert variant="destructive">
            <ShieldCheck className="size-4" />
            <AlertTitle>{t("errorTitle")}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          <Button
            size="lg"
            className="min-w-64 gap-2"
            disabled={!selectedRole || submitting}
            onClick={handleContinue}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("settingUp")}
              </>
            ) : (
              <>
                {selectedRole
                  ? t(`continueAs.${selectedRole}`)
                  : t("choosePrompt")}
                {selectedRole ? <ArrowRight className="size-4" /> : null}
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
      </div>
    </div>
  );
}
