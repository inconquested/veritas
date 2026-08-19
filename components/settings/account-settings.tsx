"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Lock,
  Palette,
  UserRound,
  Moon,
  Sun,
  Monitor,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useUser } from "@clerk/nextjs";
import { UserProfile } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SettingsArea = "client" | "freelancer";

const themeOptions = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

export function AccountSettings({ area }: { area: SettingsArea }) {
  const t = useTranslations("settings");
  const { user, isLoaded } = useUser();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");

  const initials = useMemo(() => {
    const first = user?.firstName?.[0] ?? user?.username?.[0] ?? "U";
    const last =
      user?.lastName?.[0] ??
      user?.primaryEmailAddress?.emailAddress?.[0] ??
      "S";
    return `${first}${last}`.toUpperCase();
  }, [user]);

  const email =
    user?.primaryEmailAddress?.emailAddress ?? t("no-primary-email");
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    t("your-account");
  const title =
    area === "freelancer"
      ? t("account-settings-title")
      : t("workspace-settings-title");
  const description =
    area === "freelancer"
      ? t("account-settings-desc")
      : t("workspace-settings-desc");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card/80 p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar size="lg" className="size-14">
            <AvatarImage src={user?.imageUrl} alt={fullName} />
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <CheckCircle2 className="size-3.5" />
                {t("clerk-connected")}
              </Badge>
            </div>
            <p className="max-w-[65ch] text-sm text-muted-foreground">
              {description}
            </p>
            <p className="text-sm font-medium text-foreground">
              {isLoaded ? email : t("loading-account")}
            </p>
          </div>
        </div>

        <Button asChild variant="outline" className="min-h-10 w-full sm:w-auto">
          <Link
            href={
              area === "freelancer"
                ? "/freelancer/dashboard"
                : "/client/homepage"
            }
          >
            {t("back-to-workspace")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>{t("preferences")}</CardTitle>
            <CardDescription>
              {t("preferences-desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              orientation="vertical"
              className="gap-4"
            >
              <TabsList
                className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 xl:flex xl:flex-col xl:rounded-none"
                variant="line"
              >
                <TabsTrigger
                  value="profile"
                  className="min-h-11 justify-start px-3"
                >
                  <UserRound className="size-4" />
                  {t("profile")}
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="min-h-11 justify-start px-3"
                >
                  <ShieldCheck className="size-4" />
                  {t("security")}
                </TabsTrigger>
                <TabsTrigger
                  value="password"
                  className="min-h-11 justify-start px-3"
                >
                  <Lock className="size-4" />
                  {t("password")}
                </TabsTrigger>
                <TabsTrigger
                  value="theme"
                  className="min-h-11 justify-start px-3"
                >
                  <Palette className="size-4" />
                  {t("theme")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          <TabsContent value="profile" animated className="mt-0 space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>{t("public-profile")}</CardTitle>
                <CardDescription>
                  {t("public-profile-desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FieldGroup>
                  <Field orientation="responsive">
                    <FieldLabel>
                      <FieldTitle>{t("name")}</FieldTitle>
                    </FieldLabel>
                    <FieldContent>
                      <p className="text-sm font-medium">
                        {isLoaded ? fullName : t("loading")}
                      </p>
                      <FieldDescription>
                        {t("name-desc")}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                  <Field orientation="responsive">
                    <FieldLabel>
                      <FieldTitle>{t("email-address")}</FieldTitle>
                    </FieldLabel>
                    <FieldContent>
                      <p className="text-sm font-medium">
                        {isLoaded ? email : t("loading")}
                      </p>
                      <FieldDescription>
                        {t("email-desc")}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
                <p className="text-sm text-muted-foreground">
                  {t("profile-footer")}
                </p>
                <Button asChild className="min-h-10">
                  <a href="#clerk-profile">{t("manage-profile")}</a>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="password" animated className="mt-0 space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>{t("password-sessions")}</CardTitle>
                <CardDescription>
                  {t("password-desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  {t("password-info")}
                </p>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-foreground">
                  <p className="font-medium">{t("password-rotate")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("password-rotate-desc")}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button asChild variant="outline" className="min-h-10">
                  <a href="#clerk-profile">
                    {t("account-controls")}
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="theme" animated className="mt-0 space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>{t("appearance")}</CardTitle>
                <CardDescription>
                  {t("appearance-desc")}
                </CardDescription>
                <CardAction>
                  <Badge variant="outline">{t("responsive")}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-5">
                <FieldGroup>
                  <Field orientation="responsive">
                    <FieldLabel>
                      <FieldTitle>{t("theme-mode")}</FieldTitle>
                    </FieldLabel>
                    <FieldContent>
                      <Select
                        value={theme ?? "system"}
                        onValueChange={setTheme}
                      >
                        <SelectTrigger className="min-h-10 w-full sm:w-55">
                          <SelectValue placeholder={t("select-theme")} />
                        </SelectTrigger>
                        <SelectContent>
                          {themeOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                <span>
                                  <Icon className="size-4" />
                                  {t(`theme-${option.value}`)}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        {t("theme-desc")}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <Card id="clerk-profile" className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>{t("manage-account")}</CardTitle>
              <CardDescription>
                {t("manage-account-desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-3xl border border-border/70 bg-background">
                <UserProfile
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "shadow-none border-0 rounded-none w-full bg-transparent",
                      navbar: "bg-muted/40",
                      navbarButton: "min-h-10",
                      pageScrollBox: "p-0",
                    },
                    variables: {
                      borderRadius: "0.875rem",
                    },
                  }}
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{t("clerk-sidebar-info")}</p>
                <p>
                  {t("clerk-sidebar-info2")}
                </p>
              </div>
              <Button asChild variant="ghost" className="min-h-10">
                <Link
                  href={
                    area === "freelancer"
                      ? "/freelancer/dashboard"
                      : "/client/homepage"
                  }
                >
                  {t("done")}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </Tabs>
      </div>

      <Separator />
    </div>
  );
}
