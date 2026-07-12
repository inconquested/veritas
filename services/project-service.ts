import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { CreateProjectInput, UpdateProjectInput } from "@/schemas";
import { SearchQueryParams } from "./constants";
import { Prisma } from "@/generated/prisma/client";
import { mediaService } from "./vendor/media/media-service";

export class ProjectService {
  private readonly mediaService = mediaService;

  /**
   * Creates a new project database record.
   * Edge case: Enforces structural defaults and handles unique constraint failures (e.g., slug collision).
   */
  public async createProject(d: CreateProjectInput) {
    try {
      let brief_image_urls: string[] = [];
      let thumb_url: string | undefined = d.thumb_url ?? undefined;

      if (d.brief_image_files) {
        brief_image_urls = await this.mediaService.uploadMediaMultiple(
          d.brief_image_files as File[],
        );
      }
      if (d.thumb_file) {
        thumb_url = await this.mediaService.uploadMediaSingle(
          d.thumb_file as File,
        );
      }

      const {
        brief_image_files,
        thumb_file,
        thumb_url: _thumb_url,
        milestones,
        freelancer_id,
        client_id,
        ...raw
      } = d;

      let freelancerId = freelancer_id;
      let clientId = client_id;

      if (!freelancerId || !clientId) {
        const clerkUser = await currentUser();
        const user = clerkUser
          ? await prisma.user.findUnique({
              where: { clerkUserId: clerkUser.id },
              select: { id: true },
            })
          : null;

        // ponytail: use the signed-in user for both relations until client picking exists
        freelancerId ??= user?.id;
        clientId ??= user?.id;
      }

      if (!freelancerId || !clientId) {
        throw new Error("errors.project.missing_user");
      }

      const project = await prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            ...raw,
            brief_image_urls,
            thumb_url,
            access_key: "",
            freelancer: { connect: { id: freelancerId } },
            client: { connect: { id: clientId } },
          },
        });
        if (milestones && milestones.length > 0)
          await tx.milestone.createMany({
            data: milestones.map((m) => {
              const { project_id, ...pure } = m as typeof m & {
                project_id?: string;
              };
              return {
                ...pure,
                project_id: project.id,
              };
            }),
          });
        return project;
      });
      return project;
    } catch (error) {
      // Handle Prisma unique constraint errors (e.g., Duplicate Slugs) safely
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("errors.project.duplicate_slug");
        }
      }
      if (error instanceof Error && error.message.startsWith("errors."))
        throw error;
      throw new Error(`Failed to create project: ${(error as Error).message}`);
    }
  }

  /**
   * Fetches a paginated, sorted list of projects with flexible text search.
   * Edge case: Prevents strict literal matching across multiple text fields simultaneously using OR logic.
   */
  public async getProjects({
    limit = 10,
    page = 1,
    search = "",
    sort = "asc",
    sortBy = "id",
  }: SearchQueryParams) {
    const sanitizedPage = Math.max(1, page);
    const sanitizedLimit = Math.max(1, Math.min(limit, 100)); // Cap limits to guard DB performance

    // Construct dynamic search filters using a case-insensitive logical OR
    const searchFilter: Prisma.ProjectWhereInput = search.trim()
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    try {
      const sortKeys: Record<string, string> = {
        id: "id",
        title: "title",
        status: "status",
        created_at: "createdAt",
        updated_at: "updatedAt",
        createdAt: "createdAt",
        updatedAt: "updatedAt",
      };
      const orderBy = sortKeys[sortBy ?? ""] ?? "id";

      return await prisma.project.findMany({
        skip: (sanitizedPage - 1) * sanitizedLimit,
        take: sanitizedLimit,
        where: searchFilter,
        orderBy: {
          [orderBy]: sort,
        },
        include: {
          freelancer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              instanceName: true,
              imageUrl: true,
            },
          },
          client: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              instanceName: true,
              imageUrl: true,
            },
          },
          milestones: true,
          invoices: true,
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to retrieve projects: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Retrieves a project by its primary UUID/ID string.
   */
  public async getProjectById(id: string) {
    if (!id) throw new Error("Project ID parameter is required.");

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          freelancer: true,
          client: true,
          milestones: true,
          invoices: true,
          handsouts: true,
        },
      });
      if (!project) throw new Error(`Project with ID ${id} not found.`);
      return project;
    } catch (error) {
      throw new Error(
        `Error fetching project by ID: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Retrieves a project record based on its unique URL slug identifier.
   * Edge case: Handles missing records gracefully without referencing undefined variables.
   */
  public async getProjectBySlug(slug: string) {
    if (!slug) throw new Error("Project slug parameter is required.");

    try {
      const project = await prisma.project.findUnique({
        where: { slug },
        include: {
          freelancer: true,
          client: true,
          milestones: true,
          invoices: true,
          handsouts: true,
        },
      });

      if (!project) {
        throw new Error(`Project with slug '${slug}' could not be found.`);
      }

      return project;
    } catch (error) {
      throw new Error(
        `Error fetching project by slug: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Updates an existing project record selectively based on variable changes.
   * Edge case: Separates targeting IDs from variable mutation sets to avoid updating primary keys.
   */
  public async updateProject(id: string, d: UpdateProjectInput) {
    if (!id) throw new Error("Target Project ID is required for execution.");

    try {
      const existing = await prisma.project.findUnique({
        where: { id },
        select: { thumb_url: true, brief_image_urls: true },
      });
      if (!existing) throw new Error("errors.notExist");

      const {
        brief_image_files,
        thumb_file,
        thumb_url: inputThumbUrl,
        milestones = [],
        handsouts = [],
        ...raw
      } = d;

      const brief_image_urls = brief_image_files?.length
        ? [
            ...(existing.brief_image_urls ?? []),
            ...(await this.mediaService.uploadMediaMultiple(
              brief_image_files as File[],
            )),
          ]
        : (existing.brief_image_urls ?? []);
      const thumb_url = thumb_file
        ? await this.mediaService.uploadMediaSingle(thumb_file as File)
        : (inputThumbUrl ?? existing.thumb_url ?? undefined);

      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id },
          data: { ...raw, brief_image_urls, thumb_url },
        });

        if (d.milestones !== undefined) {
          const inbound = milestones
            ?.map((m) => m.id)
            .filter((id): id is string => !!id);
          await tx.milestone.deleteMany({
            where: { project_id: id, id: { notIn: inbound } },
          });

          await Promise.all(
            milestones?.map((m) => {
              const fields = {
                title: m.title,
                description: m.description,
                ...(m.due_date ? { due_date: new Date(m.due_date) } : {}),
              };
              return m.id
                ? tx.milestone.update({
                    where: { project_id: id, id: m.id },
                    data: fields,
                  })
                : tx.milestone.create({
                    data: {
                      title: m.title,
                      description: m.description,
                      due_date: new Date(m.due_date),
                      project_id: id,
                    },
                  });
            }) ?? [],
          );
        }

        if (d.handsouts !== undefined) {
          const inbound = handsouts
            ?.map((h) => h.id)
            .filter((id): id is string => !!id);
          await tx.handsout.deleteMany({
            where: { project_id: id, id: { notIn: inbound } },
          });

          await Promise.all(
            handsouts?.map((h) => {
              const fields = {
                title: h.title,
                description: h.description,
                content_url: h.content_url,
                thumb_url: h.thumb_url,
              };
              return h.id
                ? tx.handsout.update({
                    where: { project_id: id, id: h.id },
                    data: fields,
                  })
                : tx.handsout.create({
                    data: { ...fields, project_id: id },
                  });
            }) ?? [],
          );
        }
      });

      if (thumb_url !== existing.thumb_url) {
        await this.mediaService.deleteMedia(existing.thumb_url);
      }

      return this.getProjectById(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new Error("errors.notExist");
        }
        if (error.code === "P2002") {
          throw new Error("errors.project.duplicate_slug");
        }
      }
      if (error instanceof Error && error.message.startsWith("errors."))
        throw error;
      throw new Error(`Failed to update project: ${(error as Error).message}`);
    }
  }
  /**
   * Deletes an existing project record based on its unique identifier.
   * Edge case: Handles missing records gracefully without referencing undefined variables.
   */
  public async deleteProject(id: string) {
    if (!id) throw new Error("Target Project ID is required for execution.");
    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { thumb_url: true },
      });

      await prisma.project.delete({
        where: { id },
      });
      await this.mediaService.deleteMedia(project?.thumb_url);
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new Error("errors.notExist");
      }
      throw new Error(`Failed to delete project: ${(error as Error).message}`);
    }
  }
}
