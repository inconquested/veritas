"use client";

import { Check, Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/_i18n/actions";
import { locales, type Locale } from "@/app/_i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LABELS: Record<Locale, { name: string; short: string }> = {
  en: { name: "English", short: "EN" },
  id: { name: "Bahasa Indonesia", short: "ID" },
  es: { name: "Español", short: "ES" },
  "zh-CN": { name: "中文", short: "中" },
};

interface Props {
  variant?: "default" | "mobile";
}

export default function LanguageToggle({ variant = "default" }: Props) {
  const current = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  const onSelect = (locale: Locale) => {
    if (locale === current) return;
    startTransition(() => {
      setLocale(locale);
    });
  };

  const label = LABELS[current] ?? LABELS.en;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Current language: ${label.name}`}
        disabled={pending}
        className={
          variant === "mobile"
            ? "inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            : "inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        }
      >
        <Globe className="size-3.5" strokeWidth={1.75} aria-hidden />
        <span>{label.short}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[10rem] rounded-xl p-1.5 backdrop-blur-xl"
      >
        {locales.map((code) => {
          const item = LABELS[code];
          const isActive = code === current;
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => onSelect(code)}
              className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-sm font-medium"
            >
              <span>{item.name}</span>
              {isActive ? (
                <Check className="size-3.5 text-lime-600" strokeWidth={2.25} aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
