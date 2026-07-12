import { getProject, updateProject } from "@/actions/projects";
import { notFound } from "next/navigation";
import { ProjectUpdateForm } from "./project-update-form";

type Project = {
  title: string;
  status?: string | null;
  description?: string | null;
  thumb_url?: string | null;
};

export default async function UpdateProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProject(id);

  if (!result.success) notFound();

  async function action(_state: unknown, formData: FormData) {
    "use server";
    return updateProject(formData, id);
  }

  return (
    <ProjectUpdateForm project={result.project as Project} action={action} />
  );
}
