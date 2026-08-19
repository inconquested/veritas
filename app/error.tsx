"use client";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-2xl font-bold text-destructive">
        {t("title")}
      </h1>
      <p className="mt-2 text-gray-600">{error.message}</p>
      <Button onClick={reset}>{t("tryAgain")}</Button>
    </div>
  );
}
