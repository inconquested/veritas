"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { NavItem } from "@/components/constants/sidebar-constants";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
const CollapsibleContent = CollapsiblePrimitive.Content;

export default function CollapsibleNavItem({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isChildActive =
    item.children?.some((c) => pathname === c.href) ?? false;
  const isParentActive = pathname.startsWith(item.href);
  const [open, setOpen] = useState(isParentActive || isChildActive);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem className="relative">
        <SidebarMenuButton
          asChild
          isActive={isParentActive}
          tooltip={item.title}
        >
          <Link href={item.href}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>

        {item.badge && (
          <SidebarMenuBadge className="right-7">{item.badge}</SidebarMenuBadge>
        )}

        {item.action && (
          <SidebarMenuAction asChild>
            <Link
              href={item.action.href}
              aria-label={item.action.label}
              title={item.action.label}
            >
              <Plus className="size-3.5" />
            </Link>
          </SidebarMenuAction>
        )}

        <CollapsibleTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[collapsible=icon]:hidden"
            aria-label={`Toggle ${item.title}`}
          >
            <ChevronRight
              className={`size-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-up data-[state=open]:slide-down data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <SidebarMenuSub>
            {item.action && (
              <SidebarMenuAction asChild>
                <Link
                  href={item.action.href}
                  aria-label={item.action.label}
                  title={item.action.label}
                >
                  <Plus className="size-3.5" />
                </Link>
              </SidebarMenuAction>
            )}
            {item.children?.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={pathname === child.href}
                  size="sm"
                >
                  <Link href={child.href}>
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
