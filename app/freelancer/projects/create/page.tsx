import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import ProjectCreationForm from "@/components/projects/project-creation-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("freelancer");
  return {
    title: t("projects.create-meta-title"),
    description: t("projects.create-meta-description"),
  };
}

export default function CreateProjectPage() {
  return <ProjectCreationForm />;
}
