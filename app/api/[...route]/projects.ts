// backend/routes/projects.ts
import { Hono, type Context } from "hono";
import { ProjectService } from "@/services/project-service";
import { CreateProjectSchema, UpdateProjectSchema } from "@/schemas";
import { SearchQueryParams } from "@/services/constants";
import { formatZodIssues, toJsonSafe } from "@/lib/utils";

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

  for (const key of [
    "title",
    "slug",
    "description",
    "status",
    "thumb_url",
    "freelancer_id",
    "client_id",
  ]) {
    const value = form.get(key);
    if (typeof value === "string" && value.trim()) body[key] = value;
  }

  const thumbFile = form.get("thumb_file");
  if (thumbFile instanceof File && thumbFile.size > 0)
    body.thumb_file = thumbFile;

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

/**
 * POST /api/projects
 * Creates a new project
 */
projectsApp.post("/", async (c) => {
  try {
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

    const project = await projectService.createProject(result.data);
    return c.json({ success: true, data: toJsonSafe(project) }, 201);
  } catch (error) {
    console.error("Project create failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        errorKey: errorKey(error, "errors.project.creation_failed"),
      },
      400,
    );
  }
});

/**
 * GET /api/projects
 * Retrieves paginated and filtered projects
 */
projectsApp.get("/", async (c) => {
  try {
    const query = c.req.query();
    const params = {
      limit: query.limit ? parseInt(query.limit, 10) : 10,
      page: query.page ? parseInt(query.page, 10) : 1,
      search: query.search,
      sort: query.sort as "asc" | "desc",
      sortBy: query.sortBy,
    } satisfies SearchQueryParams;

    const projects = await projectService.getProjects(params);
    return c.json({ success: true, data: toJsonSafe(projects) });
  } catch (error) {
    console.error("Projects fetch failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        errorKey: "errors.projects.fetch_failed",
      },
      500,
    );
  }
});

/**
 * GET /api/projects/:id
 * Retrieves a single project by ID
 */
projectsApp.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const project = await projectService.getProjectById(id);
    return c.json({ success: true, data: toJsonSafe(project) });
  } catch (error) {
    console.error("Project fetch failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        errorKey: "errors.notExist",
      },
      404,
    );
  }
});

/**
 * PUT /api/projects/:id
 * Updates an existing project
 */
projectsApp.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
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
    console.error("Project update failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        errorKey: errorKey(error, "errors.project.update_failed"),
      },
      400,
    );
  }
});

projectsApp.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const deleted = await projectService.deleteProject(id);
    return c.json({ success: deleted });
  } catch (error) {
    console.error("Project delete failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        errorKey: errorKey(error, "errors.project.delete_failed"),
      },
      400,
    );
  }
});

export { projectsApp };
