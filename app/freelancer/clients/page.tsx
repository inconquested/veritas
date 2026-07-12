import { listProjects } from "@/actions/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FolderOpen, Search, UsersRound } from "lucide-react";

type Project = {
  updatedAt?: string | Date | null;
  client?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    instanceName?: string | null;
    email?: string | null;
  };
};

type Client = {
  id: string;
  name: string;
  email: string;
  projects: number;
  lastActive?: string | Date | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function clientName(client: Project["client"]) {
  return (
    [client?.firstName, client?.lastName].filter(Boolean).join(" ") ||
    client?.instanceName ||
    client?.email ||
    "Client"
  );
}

function date(value: string | Date | null | undefined) {
  if (!value) return "recently";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "recently"
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const search = params?.search?.trim().toLowerCase() ?? "";
  const result = await listProjects({
    limit: 100,
    page: 1,
    sort: "desc",
    sortBy: "updated_at",
  });
  const projects = result.success
    ? ((result.projects as Project[] | undefined) ?? [])
    : [];
  const clients = Array.from(
    projects
      .reduce((map, project) => {
        const client = project.client;
        const id = client?.id ?? client?.email ?? clientName(client);
        const existing = map.get(id);
        map.set(id, {
          id,
          name: clientName(client),
          email: client?.email ?? "No email on file",
          projects: (existing?.projects ?? 0) + 1,
          lastActive: existing?.lastActive ?? project.updatedAt,
        });
        return map;
      }, new Map<string, Client>())
      .values(),
  ).filter(
    (client) =>
      !search ||
      client.name.toLowerCase().includes(search) ||
      client.email.toLowerCase().includes(search),
  );

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          {clients.length} clients across all projects
        </p>
      </div>

      <form className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="client-search"
          name="search"
          defaultValue={params?.search ?? ""}
          placeholder="Search clients..."
          className="pl-9"
        />
      </form>

      {!result.success ? (
        <Card
          className="border-destructive/30 bg-destructive/5 shadow-none"
          role="alert"
        >
          <CardContent className="p-4 text-sm">
            Couldn&apos;t load clients.
          </CardContent>
        </Card>
      ) : clients.length === 0 ? (
        <Card className="border border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <UsersRound className="h-5 w-5" aria-hidden="true" />
            No clients found. Clients appear here when projects are connected to
            them.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="border border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                  aria-hidden="true"
                >
                  {getInitials(client.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{client.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {client.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {client.projects} project
                      {client.projects !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="hidden sm:block">
                    Last active {date(client.lastActive)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
