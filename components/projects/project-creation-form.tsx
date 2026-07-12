"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { create } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";

type MilestoneDraft = {
  title: string;
  dueDate: string;
};

type ActionResult = {
  success?: boolean;
  errors?: Record<string, string>;
  errorKey?: string;
};

const steps = ["Project Details", "Milestones", "Review"];

export default function ProjectCreationForm() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const thumbFileInputRef = useRef<HTMLInputElement>(null);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { title: "", dueDate: "" },
  ]);

  const [state, formAction, isPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(async (_prevState) => {
    const payload = new FormData();

    payload.set("title", title);
    payload.set("slug", slug);
    if (description) payload.set("description", description);
    if (thumbUrl) payload.set("thumb_url", thumbUrl);
    if (thumbFile instanceof File && thumbFile.size > 0) {
      payload.set("thumb_file", thumbFile);
    }

    const parsedMilestones = milestones
      .map((item) => ({
        title: item.title.trim(),
        due_date: item.dueDate.trim(),
      }))
      .filter((item) => item.title && item.due_date)
      .map((item) => ({
        title: item.title,
        due_date: new Date(item.due_date).toISOString(),
      }));

    if (parsedMilestones.length > 0) {
      payload.set("milestones", JSON.stringify(parsedMilestones));
    }

    return create(payload) as Promise<ActionResult>;
  }, undefined);

  const reviewMilestones = useMemo(
    () => milestones.filter((item) => item.title.trim() || item.dueDate.trim()),
    [milestones],
  );
  const errorEntries = Object.entries(state?.errors ?? {});

  const handleThumbFileChange = (file: File | null) => {
    setThumbFile(file);

    const input = thumbFileInputRef.current;
    if (!input) return;

    const transfer = new DataTransfer();
    if (file) transfer.items.add(file);
    input.files = transfer.files;
  };

  const addMilestone = () => {
    setMilestones((current) => [...current, { title: "", dueDate: "" }]);
  };

  const setMilestone = (
    index: number,
    field: keyof MilestoneDraft,
    value: string,
  ) => {
    setMilestones((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  return (
    <form
      action={formAction}
      className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Create New Project
        </h1>
        <p className="text-sm text-muted-foreground">
          Minimal form, real payload. Cover image can come from a URL or a file
          upload.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((label, index) => (
          <div
            key={label}
            className="flex flex-1 items-center gap-2 last:flex-none"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                index < step
                  ? "bg-primary text-primary-foreground"
                  : index === step
                    ? "border-2 border-primary bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {index < step ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={`hidden text-sm font-medium sm:block ${index === step ? "text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </span>
            {index < steps.length - 1 ? (
              <div
                className={`h-px flex-1 ${index < step ? "bg-primary" : "bg-border"}`}
              />
            ) : null}
          </div>
        ))}
      </div>

      <Card className="border border-border/60 shadow-sm lg:min-w-2xl">
        {step === 0 ? (
          <>
            <CardHeader>
              <CardTitle className="text-base">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="title">Project title</FieldLabel>
                  <FieldContent>
                    <Input
                      id="title"
                      name="title"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setSlug(slugify(e.target.value));
                      }}
                      placeholder="Brand Identity System"
                    />
                    <FieldError
                      errors={
                        state?.errors?.title
                          ? [{ message: state.errors.title }]
                          : undefined
                      }
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="slug">Slug</FieldLabel>
                  <FieldContent>
                    <Input
                      id="slug"
                      name="slug"
                      value={slug}
                      disabled
                      placeholder="brand-identity-system"
                    />
                    <FieldDescription>
                      You don't have to write it. This is automatically
                      generated.
                    </FieldDescription>
                    <FieldError
                      errors={
                        state?.errors?.slug
                          ? [{ message: state.errors.slug }]
                          : undefined
                      }
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="description"
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the scope, goals and outcome."
                      rows={4}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldContent>
                    <input type="hidden" name="thumb_url" value={thumbUrl} />
                    <input
                      ref={thumbFileInputRef}
                      type="file"
                      name="thumb_file"
                      className="hidden"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setThumbFile(file);
                        if (file) setThumbUrl("");
                      }}
                    />
                    <ImageUploader
                      label="Cover image"
                      urlValue={thumbUrl}
                      onUrlChange={(value) => {
                        setThumbUrl(value);
                        if (value) handleThumbFileChange(null);
                      }}
                      fileValue={thumbFile}
                      onFileChange={handleThumbFileChange}
                      placeholder="https://images.example.com/cover.jpg"
                    />
                    {thumbFile ? (
                      <input
                        type="hidden"
                        name="thumb_file_name"
                        value={thumbFile.name}
                      />
                    ) : null}
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <CardHeader>
              <CardTitle className="text-base">Milestones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 sm:grid-cols-[1fr_180px_auto]"
                >
                  <Input
                    name="milestone_title"
                    value={milestone.title}
                    onChange={(e) =>
                      setMilestone(index, "title", e.target.value)
                    }
                    placeholder={`Milestone ${index + 1} title`}
                  />
                  <Input
                    type="date"
                    value={milestone.dueDate}
                    onChange={(e) =>
                      setMilestone(index, "dueDate", e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setMilestones((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    disabled={milestones.length === 1}
                    aria-label={`Remove milestone ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMilestone}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Add milestone
              </Button>
            </CardContent>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <CardHeader>
              <CardTitle className="text-base">Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Title</p>
                    <p className="font-medium">{title || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Slug</p>
                    <p className="font-medium">{slug || "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Description</p>
                    <p className="font-medium">{description || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cover source</p>
                    <p className="font-medium">
                      {thumbFile ? thumbFile.name : thumbUrl || "None"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Milestones</p>
                    <p className="font-medium">{reviewMilestones.length}</p>
                  </div>
                </div>
              </div>

              {state?.errorKey ? (
                <p className="text-sm text-destructive">{state.errorKey}</p>
              ) : null}
              {errorEntries.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                  {errorEntries.map(([field, message]) => (
                    <li key={field}>{message}</li>
                  ))}
                </ul>
              ) : null}
              {state?.success ? (
                <p className="text-sm text-primary">Project created.</p>
              ) : null}
            </CardContent>
          </>
        ) : null}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || isPending}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        {step < steps.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep((current) => current + 1)}
            disabled={isPending}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1 h-4 w-4" />
            )}
            Create Project
          </Button>
        )}
      </div>
    </form>
  );
}
