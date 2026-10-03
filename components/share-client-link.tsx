"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Check, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClientLink, revokeClientLink } from "@/actions/share";

export type ClientLink = {
  token: string;
  expiresAt: string | Date | null;
};

function linkOf(token: string) {
  return `${window.location.origin}/p/${token}`;
}

export default function ShareClientLink({
  projectId,
  links,
}: {
  projectId: string;
  links: ClientLink[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkOf(token));
    } catch {
      window.prompt("Salin link klien:", linkOf(token));
      return;
    }
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
  }

  async function create() {
    setPending(true);
    setError(null);
    try {
      const result = await createClientLink(projectId);
      if (!result.success) {
        setError("Gagal membuat link.");
        return;
      }
      if (result.token) await copy(result.token);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function revoke(token: string) {
    setPending(true);
    setError(null);
    try {
      const result = await revokeClientLink(projectId, token);
      if (!result.success) setError("Gagal revoke link.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Link Klien (tanpa login)
          </p>
          <Button size="sm" variant="outline" disabled={pending} onClick={create}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {links.length ? "Link baru" : "Buat link"}
          </Button>
        </div>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada link. Buat satu lalu kirim via WA — klien langsung lihat
            progress & bayar.
          </p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li
                key={link.token}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
              >
                <span className="truncate font-mono text-xs">
                  /p/{link.token.slice(0, 8)}…
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => copy(link.token)}
                    aria-label="Salin Link Klien"
                  >
                    {copied === link.token ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copied === link.token ? "Tersalin" : "Salin"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => revoke(link.token)}
                    aria-label="Revoke link"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Revoke
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
