import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { ContractService } from "@/services/contract-service";
import { buildStandardContract } from "@/lib/contract-template";

export const dynamic = "force-dynamic";

async function create(form: FormData) {
  "use server";
  const svc = new ContractService(prisma as any);
  await svc.createContract(String(form.get("projectId")), String(form.get("body")));
  revalidatePath(`/freelancer/projects/${String(form.get("projectId"))}/contract`);
}

async function sign(form: FormData) {
  "use server";
  const svc = new ContractService(prisma as any);
  await svc.signContract(
    String(form.get("projectId")),
    String(form.get("role")),
    String(form.get("name")),
  );
  revalidatePath(`/freelancer/projects/${String(form.get("projectId"))}/contract`);
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const project = await (prisma as any).project
    .findUnique({ where: { id: projectId }, select: { id: true, title: true } })
    .catch(() => null);
  if (!project) notFound();

  const svc = new ContractService(prisma as any);
  const v = await svc.verifyContract(projectId).catch(() => null);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <header>
        <h1 className="text-xl font-bold">Kontrak — {project.title}</h1>
        {v ? (
          <p className="text-sm">
            Status:{" "}
            <strong>
              {v.valid ? (v.fullySigned ? "SIGNED VALID" : "BELUM LENGKAP") : "INVALID (diubah setelah signed)"}
            </strong>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada kontrak — buat dari template standar.</p>
        )}
      </header>
      {v ? (
        <>
          <pre className="whitespace-pre-wrap rounded-lg border p-4 text-xs leading-relaxed">
            {v.contract.body}
          </pre>
          {!v.fullySigned ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {(["FREELANCER", "CLIENT"] as const).map((role) => (
                <form key={role} action={sign} className="flex flex-1 gap-2">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="role" value={role} />
                  <input
                    name="name"
                    required
                    placeholder={`Nama ${role === "FREELANCER" ? "freelancer" : "klien"} (ketik)`}
                    className="min-w-0 flex-1 rounded border px-2 py-1.5 text-sm"
                  />
                  <button type="submit" className="rounded border px-3 py-1.5 text-sm">
                    Sign {role}
                  </button>
                </form>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <form action={create}>
          <input type="hidden" name="projectId" value={projectId} />
          <button type="submit" className="rounded bg-foreground px-3 py-2 text-sm text-background">
            Buat kontrak standar
          </button>
          <input
            type="hidden"
            name="body"
            value={buildStandardContract({
              freelancerName: "Freelancer",
              clientName: "Klien",
              projectTitle: project.title,
              total: 10000000,
            })}
          />
        </form>
      )}
    </div>
  );
}
