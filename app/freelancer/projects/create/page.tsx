import { Metadata } from "next";

import ProjectCreationForm from "@/components/projects/project-creation-form";

export const metadata: Metadata = {
  title: "Create New Project",
  description: "Set up a new client project in just a few steps.",
};

export default function CreateProjectPage() {
  return <ProjectCreationForm />;
}
