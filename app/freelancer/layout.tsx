"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {useInitial} from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  ChevronsUpDown,
  Milestone,
  TrendingUp,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CollapsibleNavItem from "@/components/sections/sidebar/collapsible-nav-menu";
import { NavItem } from "@/components/constants/sidebar-constants";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useClerk, useUser } from "@clerk/nextjs";

/* ─── Navigation config ─── */
const navMain: NavItem[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/freelancer/dashboard",
  },
  {
    title: "Projects",
    icon: FolderOpen,
    href: "/freelancer/projects",
    badge: "6",
    action: { href: "/freelancer/projects/create", label: "New Project" },
    children: [
      { title: "All Projects", href: "/freelancer/projects" },
      { title: "Create New", href: "/freelancer/projects/create" },
    ],
  },
  {
    title: "Clients",
    icon: Users,
    href: "/freelancer/clients",
    badge: "5",
    children: [{ title: "All Clients", href: "/freelancer/clients" }],
  },
];

const navInsights: NavItem[] = [
  { title: "Revenue", icon: TrendingUp, href: "/freelancer/dashboard" },
  { title: "Invoices", icon: Receipt, href: "/freelancer/dashboard" },
  { title: "Milestones", icon: Milestone, href: "/freelancer/dashboard" },
];

export default function FreelancerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const { signOut } = useClerk();
  const {user} = useUser();

  useKeyboardShortcuts([
    { key: "d", href: "/freelancer/dashboard", description: "Go to Dashboard", requiresPrefix: true },
    { key: "p", href: "/freelancer/projects", description: "Go to Projects", requiresPrefix: true },
    { key: "c", href: "/freelancer/clients", description: "Go to Clients", requiresPrefix: true },
    { key: "n", href: "/freelancer/projects/create", description: "Create New Project", requiresPrefix: true },
    { key: "s", href: "/freelancer/settings", description: "Go to Settings", requiresPrefix: true },
  ]);

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        {/* ─── Header: Logo ─── */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Veritas">
                <Link href="/freelancer/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Veritas</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Freelancer
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        {/* ─── Main nav ─── */}
        <SidebarContent className="gap-0!">
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navMain.map((item) => {
                  const Icon = item.icon;
                  return item.children ? (
                    <CollapsibleNavItem
                      key={item.title}
                      item={item}
                      pathname={pathname}
                    />
                  ) : (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          {Icon && <Icon />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* ─── Insights shortcuts ─── */}
          <SidebarGroup>
            <SidebarGroupLabel>Insights</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navInsights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <Link href={item.href}>
                          {Icon && <Icon />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="mt-auto" />
        </SidebarContent>

        {/* ─── Footer: User menu ─── */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/15 text-xs font-bold text-primary">
                        {useInitial(`${user?.firstName} ${user?.lastName}` || "FL")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Freelancer</span>
                      <span className="truncate text-xs text-muted-foreground">
                        hello@freelancer.dev
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-primary/15 text-xs font-bold text-primary">
                          useInitial(`${user?.firstName} ${user?.lastName}` || "FL")
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user?.firstName} {user?.lastName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          hello@freelancer.dev
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/freelancer/settings"
                        className="flex items-center gap-2"
                      >
                        <Settings />
                        Account Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Top bar with trigger */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-border" />
          <Breadcrumb>
            <BreadcrumbList>
              {pathname
                .split("/")
                .filter(Boolean)
                .map((segment, index, segments) => {
                  const href =
                    index === 0
                      ? "/freelancer/dashboard"
                      : `/${segments.slice(0, index + 1).join("/")}`;
                  const isLast = index === segments.length - 1;
                  const label =
                    segment.charAt(0).toUpperCase() + segment.slice(1);
                  return (
                    <Fragment key={href + index}>
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={href}>{label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </Fragment>
                  );
                })}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        {children}
      </SidebarInset>
    </>
  );
}
