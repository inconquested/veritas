"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  CreateProjectInput,
  CreateProjectSchema,
  UpdateProjectInput,
  UpdateProjectSchema,
} from "@/schemas";
import { client } from "@/lib/api-client";
import {
  issuesToErrors,
  translateErrorKey,
  validateWithTranslation,
} from "@/lib/utils";
import {
  guardAction,
  timeoutSignal,
  TIMEOUT_ERROR_KEY,
} from "@/lib/action-timeout";

function normalizeProjectPayload(raw: unknown) {
  if (raw instanceof FormData) {
    const payload: Record<string, unknown> = {};

    for (const key of ["title", "slug", "description", "status", "thumb_url"]) {
      const value = raw.get(key);
      if (typeof value === "string" && value.trim()) payload[key] = value;
    }

    const thumbFile = raw.get("thumb_file");
    if (thumbFile instanceof File && thumbFile.size > 0) {
      payload.thumb_file = thumbFile;
    }

    const milestones = raw.get("milestones");
    if (typeof milestones === "string" && milestones.trim()) {
      payload.milestones = JSON.parse(milestones);
    }

    return normalizeProjectPayload(payload);
  }

  if (!raw || typeof raw !== "object") return raw;

  const payload = { ...(raw as Record<string, unknown>) };

  if (typeof payload.thumb_url === "string" && payload.thumb_url.trim()) {
    delete payload.thumb_file;
  }

  return payload;
}

function hasFiles(payload: unknown) {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as Record<string, unknown>).thumb_file instanceof File
  );
}

function toProjectForm(payload: Record<string, unknown>) {
  const form: Record<string, string | File> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    form[key] = value instanceof File ? value : JSON.stringify(value);
  }

  for (const key of ["title", "slug", "description", "status", "thumb_url"]) {
    if (typeof payload[key] === "string") form[key] = payload[key];
  }

  return form;
}

async function apiInit() {
  return {
    headers: { cookie: (await cookies()).toString() },
    init: { signal: timeoutSignal() },
  };
}

async function apiFailure(response: Response, fallback: string, t?: any) {
  if (response.headers.get("content-type")?.includes("application/json")) {
    const body = (await response.json()) as {
      errorKey?: string;
      issues?: { field: string; key: string }[];
    };

    return {
      errorKey: t
        ? translateErrorKey(t, body.errorKey ?? fallback)
        : (body.errorKey ?? fallback),
      errors: body.issues?.length ? issuesToErrors(body.issues, t) : undefined,
    };
  }

  return { errorKey: `${fallback}_${response.status}` };
}

export async function createProject(raw: unknown) {
  const t = await getTranslations("errors");
  const payload = normalizeProjectPayload(raw);

  const valid = validateWithTranslation<CreateProjectInput>(
    CreateProjectSchema,
    payload,
    t,
  );

  if (!valid.success) {
    return { success: false, errors: valid.errors };
  }

  return guardAction(
    async () => {
      const response = await (client as any).api.v1.projects.$post(
        hasFiles(valid.data)
          ? { form: toProjectForm(valid.data as Record<string, unknown>) }
          : { json: valid.data },
        await apiInit(),
      );

      if (!response.ok) {
        return {
          success: false,
          ...(await apiFailure(response, "errors.project.creation_failed", t)),
        };
      }

      const resBody = (await response.json()) as { data?: unknown };
      revalidatePath("/client/projects");
      revalidatePath("/freelancer/projects");
      return { success: true, data: resBody.data };
    },
    ({ timedOut }) => ({
      success: false,
      errorKey: translateErrorKey(
        t,
        timedOut ? TIMEOUT_ERROR_KEY : "errors.project.creation_failed",
      ),
    }),
  );
}

export async function updateProject(raw: unknown, projectId: string) {
  const t = await getTranslations("errors");
  const payload = normalizeProjectPayload(raw);

  const valid = validateWithTranslation<UpdateProjectInput>(
    UpdateProjectSchema,
    payload,
    t,
  );

  if (!valid.success) {
    return { success: false, errors: valid.errors };
  }

  return guardAction(
    async () => {
      const response = await (client as any).api.v1.projects[":id"].$put(
        {
          param: { id: projectId },
          ...(hasFiles(valid.data)
            ? { form: toProjectForm(valid.data as Record<string, unknown>) }
            : { json: valid.data }),
        },
        await apiInit(),
      );

      if (!response.ok) {
        return {
          success: false,
          ...(await apiFailure(response, "errors.project.update_failed", t)),
        };
      }

      const resBody = (await response.json()) as { data?: unknown };
      revalidatePath("/client/projects");
      revalidatePath(`/client/projects/${projectId}`);
      revalidatePath("/freelancer/projects");
      revalidatePath(`/freelancer/projects/${projectId}`);
      return { success: true, data: resBody.data };
    },
    ({ timedOut }) => ({
      success: false,
      errorKey: translateErrorKey(
        t,
        timedOut ? TIMEOUT_ERROR_KEY : "errors.project.update_failed",
      ),
    }),
  );
}

export async function getProject(projectId: string) {
  return guardAction(
    async () => {
      const response = await (client as any).api.v1.projects[":id"].$get(
        { param: { id: projectId } },
        await apiInit(),
      );

      if (!response.ok) {
        return {
          success: false,
          ...(await apiFailure(response, "errors.notExist")),
        };
      }

      const resBody = (await response.json()) as { data?: unknown };
      return { success: true, project: resBody.data };
    },
    ({ timedOut }) => ({
      success: false,
      errorKey: timedOut ? TIMEOUT_ERROR_KEY : "errors.notExist",
    }),
  );
}

export async function deleteProject(projectId: string) {
  return guardAction(
    async () => {
      const response = await (client as any).api.v1.projects[":id"].$delete(
        { param: { id: projectId } },
        await apiInit(),
      );

      if (!response.ok) {
        return {
          success: false,
          ...(await apiFailure(response, "errors.project.delete_failed")),
        };
      }

      const resBody = (await response.json()) as { success?: boolean };
      revalidatePath("/client/projects");
      revalidatePath("/freelancer/projects");
      revalidatePath(`/client/projects/${projectId}`);
      revalidatePath(`/freelancer/projects/${projectId}`);
      return { success: resBody.success ?? false };
    },
    ({ timedOut }) => ({
      success: false,
      errorKey: timedOut ? TIMEOUT_ERROR_KEY : "errors.project.delete_failed",
    }),
  );
}

export async function listProjects(query?: {
  limit?: number;
  page?: number;
  search?: string;
  sort?: "asc" | "desc";
  sortBy?: string;
}) {
  return guardAction(
    async () => {
      const response = await (client as any).api.v1.projects.$get(
        { query: query && Object.keys(query).length ? query : undefined },
        await apiInit(),
      );

      if (!response.ok) {
        return {
          success: false,
          ...(await apiFailure(response, "errors.projects.fetch_failed")),
        };
      }

      const resBody = (await response.json()) as { data?: unknown };
      // `errorKey: undefined` keeps the success and failure branches structurally
      // aligned so callers can read `result.errorKey` without narrowing first.
      return { success: true, projects: resBody.data, errorKey: undefined };
    },
    ({ timedOut, error }) => {
      if (!timedOut) console.error("Fetch projects failed:", error);
      return {
        success: false,
        errorKey: timedOut ? TIMEOUT_ERROR_KEY : "errors.projects.network_error",
      };
    },
  );
}

export const create = createProject;
export const update = updateProject;
