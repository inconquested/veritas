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
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function AccountSettings({ area }: { area: SettingsArea }) {
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

  const email = user?.primaryEmailAddress?.emailAddress ?? "No primary email";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Your account";
  const title =
    area === "freelancer" ? "Account settings" : "Workspace settings";
  const description =
    area === "freelancer"
      ? "Manage your profile, password, authentication, and appearance."
      : "Manage your profile access, sign-in security, and workspace appearance.";

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
                Clerk connected
              </Badge>
            </div>
            <p className="max-w-[65ch] text-sm text-muted-foreground">
              {description}
            </p>
            <p className="text-sm font-medium text-foreground">
              {isLoaded ? email : "Loading account..."}
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
            Back to workspace
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Everything that affects how you sign in and how the app feels.
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
                  Profile
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="min-h-11 justify-start px-3"
                >
                  <ShieldCheck className="size-4" />
                  Security
                </TabsTrigger>
                <TabsTrigger
                  value="password"
                  className="min-h-11 justify-start px-3"
                >
                  <Lock className="size-4" />
                  Password
                </TabsTrigger>
                <TabsTrigger
                  value="theme"
                  className="min-h-11 justify-start px-3"
                >
                  <Palette className="size-4" />
                  Theme
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          <TabsContent value="profile" animated className="mt-0 space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>Public profile</CardTitle>
                <CardDescription>
                  Update your name, avatar, and contact details through Clerk.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FieldGroup>
                  <Field orientation="responsive">
                    <FieldLabel>
                      <FieldTitle>Name</FieldTitle>
                    </FieldLabel>
                    <FieldContent>
                      <p className="text-sm font-medium">
                        {isLoaded ? fullName : "Loading..."}
                      </p>
                      <FieldDescription>
                        Your display name is shared across your signed-in
                        workspace.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                  <Field orientation="responsive">
                    <FieldLabel>
                      <FieldTitle>Email address</FieldTitle>
                    </FieldLabel>
                    <FieldContent>
                      <p className="text-sm font-medium">
                        {isLoaded ? email : "Loading..."}
                      </p>
                      <FieldDescription>
                        Use Clerk to add, verify, or switch primary email
                        addresses.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
                <p className="text-sm text-muted-foreground">
                  Profile editing stays inside Clerk so auth state and verified
                  fields stay in sync.
                </p>
                <Button asChild className="min-h-10">
                  <a href="#clerk-profile">Manage profile</a>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="password" animated className="mt-0 space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>Password and sessions</CardTitle>
                <CardDescription>
                  Reset your password and review active devices from the same
                  secure account panel.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Clerk already handles password updates, session revocation,
                  and email verification flows.
                </p>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-foreground">
                  <p className="font-medium">Need to rotate your password?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use the security tab below to change it without building a
                    duplicate form.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button asChild variant="outline" className="min-h-10">
                  <a href="#clerk-profile">
                    Go to account controls
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="theme" animated className="mt-0 space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Choose how Veritas looks on this device. System follows your
                  OS preference.
                </CardDescription>
                <CardAction>
                  <Badge variant="outline">Responsive</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-5">
                <FieldGroup>
                  <Field orientation="responsive">
                    <FieldLabel>
                      <FieldTitle>Theme mode</FieldTitle>
                    </FieldLabel>
                    <FieldContent>
                      <Select
                        value={theme ?? "system"}
                        onValueChange={setTheme}
                      >
                        <SelectTrigger className="min-h-10 w-full sm:w-55">
                          <SelectValue placeholder="Select theme" />
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
                                  {option.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Theme changes apply instantly and also style Clerk's
                        embedded account UI.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <Card id="clerk-profile" className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Manage account with Clerk</CardTitle>
              <CardDescription>
                Profile details, password changes, multi-factor auth, and
                connected sign-in methods live here.
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
                <p>Use the sidebar inside Clerk for deeper account flows.</p>
                <p>
                  That includes profile, security, connected accounts, and
                  session management.
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
                  Done
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
