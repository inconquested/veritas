"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statuses = [
  "ONBOARDING",
  "RESEARCH",
  "MODELLING",
  "DEPLOYMENT",
  "MAINTENANCE",
  "COMPLETED",
  "CANCELLED",
];

type ActionState = {
  success?: boolean;
  errorKey?: string;
  errors?: Record<string, string>;
} | null;

type Project = {
  title: string;
  status?: string | null;
  description?: string | null;
  thumb_url?: string | null;
};

export function ProjectUpdateForm({
  project,
  action,
}: {
  project: Project;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [router, state?.success]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6 p-6 lg:p-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Edit Project</h2>
        <p className="text-sm text-muted-foreground">
          Update project details and status
        </p>
      </div>

      {state?.success ? (
        <div
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700"
          role="status"
        >
          Project updated.
        </div>
      ) : state ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
          role="alert"
        >
          {state.errorKey ??
            "Could not update the project. Check the highlighted fields."}
        </div>
      ) : null}

      <Card className="border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={project.title}
              aria-invalid={Boolean(state?.errors?.title)}
            />
            {state?.errors?.title ? (
              <p className="text-xs text-destructive">{state.errors.title}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={project.status ?? "ONBOARDING"}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {state?.errors?.status ? (
              <p className="text-xs text-destructive">{state.errors.status}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={project.description ?? ""}
              rows={4}
            />
            {state?.errors?.description ? (
              <p className="text-xs text-destructive">
                {state.errors.description}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="thumb_url">Thumbnail URL</Label>
            <Input
              id="thumb_url"
              name="thumb_url"
              defaultValue={project.thumb_url ?? ""}
              placeholder="https://..."
            />
            {state?.errors?.thumb_url ? (
              <p className="text-xs text-destructive">
                {state.errors.thumb_url}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="thumb_file">Replace thumbnail</Label>
            <Input
              id="thumb_file"
              name="thumb_file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
            />
            {state?.errors?.thumb_file ? (
              <p className="text-xs text-destructive">
                {state.errors.thumb_file}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
