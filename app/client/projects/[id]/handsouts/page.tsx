import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, FileImage, FileText, PackageOpen } from "lucide-react";

type Handsout = {
  id: string;
  title: string;
  description?: string | null;
  content_url?: string | null;
  thumb_url?: string | null;
  created_at?: string | Date | null;
};

type Project = {
  id: string;
  handsouts?: Handsout[];
};

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return "Recently added";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ClientHandsoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProject(id);

  if (!result.success) {
    notFound();
  }

  const project = result.project as Project;
  const handsouts = toArray<Handsout>(project.handsouts);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Deliverables</h2>
        <p className="text-sm text-muted-foreground">
          Files and assets shared for this project
        </p>
      </div>

      <Tabs value="handsouts" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" asChild>
            <Link href={`/client/projects/${id}`}>Overview</Link>
          </TabsTrigger>
          <TabsTrigger value="timeline" asChild>
            <Link href={`/client/projects/${id}/timeline`}>Timeline</Link>
          </TabsTrigger>
          <TabsTrigger value="handsouts" asChild>
            <Link href={`/client/projects/${id}/handsouts`}>Handsouts</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {handsouts.length === 0 ? (
        <Empty className="border border-dashed border-border/70 bg-muted/20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageOpen className="h-4 w-4" />
            </EmptyMedia>
            <EmptyTitle>No deliverables yet</EmptyTitle>
            <EmptyDescription>
              As soon as the backend attaches handsouts to this project,
              they&apos;ll show up here as downloadable cards.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {handsouts.map((handsout) => {
            const Icon = handsout.thumb_url ? FileImage : FileText;
            return (
              <Card
                key={handsout.id}
                className="group border border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-32 items-center justify-center rounded-t-xl border-b border-border/40 bg-muted/50">
                  <Icon className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <CardContent className="space-y-2 p-4">
                  <p className="text-sm font-semibold">{handsout.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {handsout.description ??
                      "Project delivery asset available for review."}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatShortDate(handsout.created_at)}
                    </span>
                    {handsout.content_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        asChild
                      >
                        <a
                          href={handsout.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Open
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
