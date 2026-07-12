"use client";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, BadgeQuestionMarkIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <BadgeQuestionMarkIcon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-4xl font-semibold">{t("title")}</h1>
      <p className="text-lg text-muted-foreground">{t("description")}</p>
      <Button>
        <Link href="/" className="flex items-center gap-1">
          {t("backHome")} <ArrowUpRight />
        </Link>
      </Button>
    </div>
  );
}
