"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

export default function ProjectCreationForm() {
  const t = useTranslations("project-create");
  const router = useRouter();
  const steps = [t("step-details"), t("step-milestones"), t("step-review")];
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

  useEffect(() => {
    if (state?.success) {
      router.push("/freelancer/projects");
    }
  }, [state?.success, router]);

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
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
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
              <CardTitle className="text-base">{t("step-details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="title">{t("title")}</FieldLabel>
                  <FieldContent>
                    <Input
                      id="title"
                      name="title"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setSlug(slugify(e.target.value));
                      }}
                      placeholder={t("title-placeholder-example")}
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
                  <FieldLabel htmlFor="slug">{t("slug-label")}</FieldLabel>
                  <FieldContent>
                    <Input
                      id="slug"
                      name="slug"
                      value={slug}
                      disabled
                      placeholder={t("slug-placeholder-example")}
                    />
                    <FieldDescription>
                      {t("slug-description")}
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
                  <FieldLabel htmlFor="description">{t("description")}</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="description"
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("description-placeholder-example")}
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
                      label={t("cover-image")}
                      urlValue={thumbUrl}
                      onUrlChange={(value) => {
                        setThumbUrl(value);
                        if (value) handleThumbFileChange(null);
                      }}
                      fileValue={thumbFile}
                      onFileChange={handleThumbFileChange}
                      placeholder={t("cover-placeholder")}
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
              <CardTitle className="text-base">{t("step-milestones")}</CardTitle>
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
                    placeholder={t("milestone-title-placeholder", {
                      number: index + 1,
                    })}
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
                    aria-label={t("remove-milestone", { number: index + 1 })}
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
                {t("add-milestone")}
              </Button>
            </CardContent>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <CardHeader>
              <CardTitle className="text-base">{t("step-review")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">{t("review-title")}</p>
                    <p className="font-medium">{title || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("slug-label")}</p>
                    <p className="font-medium">{slug || "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">{t("description")}</p>
                    <p className="font-medium">{description || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("review-cover")}</p>
                    <p className="font-medium">
                      {thumbFile ? thumbFile.name : thumbUrl || t("review-none")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("step-milestones")}</p>
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
                <p className="text-sm text-primary">{t("success")}</p>
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
          {t("back")}
        </Button>
        {step < steps.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep((current) => current + 1)}
            disabled={isPending}
          >
            {t("next")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1 h-4 w-4" />
            )}
            {t("submit")}
          </Button>
        )}
      </div>
    </form>
  );
}
