// backend/routes/projects.ts
import { Hono, type Context } from "hono";
import { ProjectService } from "@/services/project-service";
import { CreateProjectSchema, UpdateProjectSchema } from "@/schemas";
import { SearchQueryParams } from "@/services/constants";
import { formatZodIssues, toJsonSafe } from "@/lib/utils";
import {
  authErrorResponse,
  projectScopeWhere,
  requireProjectAccess,
  requireRole,
  requireUser,
} from "@/services/auth-context";

const projectsApp = new Hono({ strict: false });
const projectService = new ProjectService();

function parseJsonField(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return JSON.parse(value);
}

async function projectBody(c: Context) {
  const type = c.req.header("content-type") ?? "";
  if (
    !type.includes("multipart/form-data") &&
    !type.includes("x-www-form-urlencoded")
  ) {
    return c.req.json();
  }

  const form = await c.req.formData();
  const body: Record<string, unknown> = {};

  // Ownership fields (freelancer_id/client_id) are intentionally NOT read here —
  // the server derives them from the authenticated session, never the payload.
  for (const key of ["title", "slug", "description", "status", "thumb_url"]) {
    const value = form.get(key);
    if (typeof value === "string" && value.trim()) body[key] = value;
  }

  const thumbFile = form.get("thumb_file");
  if (thumbFile instanceof File && thumbFile.size > 0)
    body.thumb_file = thumbFile;

  const briefFiles = form
    .getAll("brief_files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (briefFiles.length) body.brief_image_files = briefFiles;

  const milestones = parseJsonField(form.get("milestones"));
  if (milestones) body.milestones = milestones;

  const handsouts = parseJsonField(form.get("handsouts"));
  if (handsouts) body.handsouts = handsouts;

  return body;
}

function errorKey(error: unknown, fallback: string) {
  return error instanceof Error && error.message.startsWith("errors.")
    ? error.message
    : fallback;
}

// Emit an auth-aware failure: AuthError -> its mapped status, otherwise the
// domain fallback. Keeps every handler's catch block to one line.
function fail(c: Context, error: unknown, fallback: string, status = 400) {
  const auth = authErrorResponse(error);
  if (auth) return c.json(auth.body, auth.status as never);
  console.error("Projects API error", {
    fallback,
    message: error instanceof Error ? error.message : String(error),
  });
  return c.json(
    { success: false, errorKey: errorKey(error, fallback) },
    status as never,
  );
}

/**
 * POST /api/projects
 * Creates a new project. Freelancers only; the project is owned by the caller.
 */
projectsApp.post("/", async (c) => {
  try {
    const user = await requireUser();
    requireRole(user, "FREELANCER");

    const result = CreateProjectSchema.safeParse(await projectBody(c));
    if (!result.success) {
      return c.json(
        {
          success: false,
          errorKey: "errors.validation_failed",
          issues: formatZodIssues(result.error.issues),
        },
        400,
      );
    }

    // No client-picker UI yet: default the client relation to the freelancer.
    // A supplied client_id is honored only if it resolves to a real user.
    const clientId = result.data.client_id ?? user.id;
    const project = await projectService.createProject(result.data, {
      freelancerId: user.id,
      clientId,
    });
    return c.json({ success: true, data: toJsonSafe(project) }, 201);
  } catch (error) {
    return fail(c, error, "errors.project.creation_failed");
  }
});

/**
 * GET /api/projects
 * Retrieves the caller's own paginated/filtered projects.
 */
projectsApp.get("/", async (c) => {
  try {
    const user = await requireUser();
    const query = c.req.query();
    const params = {
      limit: query.limit ? parseInt(query.limit, 10) : 10,
      page: query.page ? parseInt(query.page, 10) : 1,
      search: query.search,
      sort: query.sort as "asc" | "desc",
      sortBy: query.sortBy,
    } satisfies SearchQueryParams;

    const projects = await projectService.getProjects(
      params,
      projectScopeWhere(user),
    );
    return c.json({ success: true, data: toJsonSafe(projects) });
  } catch (error) {
    return fail(c, error, "errors.projects.fetch_failed", 500);
  }
});

/**
 * GET /api/projects/:id
 * Retrieves a single project the caller is a party to.
 */
projectsApp.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const user = await requireUser();
    await requireProjectAccess(id, user, "read");
    const project = await projectService.getProjectById(id);
    return c.json({ success: true, data: toJsonSafe(project) });
  } catch (error) {
    return fail(c, error, "errors.notExist", 404);
  }
});

/**
 * PUT /api/projects/:id
 * Updates a project. Only the owning freelancer may modify it.
 */
projectsApp.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const user = await requireUser();
    await requireProjectAccess(id, user, "write");

    const result = UpdateProjectSchema.safeParse(await projectBody(c));
    if (!result.success) {
      return c.json(
        {
          success: false,
          errorKey: "errors.validation_failed",
          issues: formatZodIssues(result.error.issues),
        },
        400,
      );
    }

    const updatedProject = await projectService.updateProject(id, result.data);
    return c.json({ success: true, data: toJsonSafe(updatedProject) });
  } catch (error) {
    return fail(c, error, "errors.project.update_failed");
  }
});

/**
 * DELETE /api/projects/:id
 * Deletes a project. Only the owning freelancer may delete it.
 */
projectsApp.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const user = await requireUser();
    await requireProjectAccess(id, user, "write");
    const deleted = await projectService.deleteProject(id);
    return c.json({ success: deleted });
  } catch (error) {
    return fail(c, error, "errors.project.delete_failed");
  }
});

export { projectsApp };
