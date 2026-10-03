import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_BAD_ROLE,
  WORKSPACE_FORBIDDEN,
  WorkspaceService,
  canInviteMember,
  toStudioRole,
} from "../services/workspace-service";
import {
  __clearWorkspaceProjects,
  getProjectWorkspace,
  listWorkspaceProjects,
  moveProjectToWorkspace,
} from "../services/workspace-projects";
import { summarizeWorkload } from "../lib/workload";

function createMockDb() {
  const workspaces: any[] = [];
  const members: any[] = [];
  let n = 0;
  const db = {
    workspace: {
      create: async (q: any) => {
        n += 1;
        const row = { id: `w${n}`, ...q.data };
        workspaces.push(row);
        return row;
      },
      findMany: async () => workspaces,
    },
    workspaceMember: {
      create: async (q: any) => {
        const row = { id: `m${members.length + 1}`, ...q.data };
        members.push(row);
        return row;
      },
      findMany: async (q: any) => {
        const where = q?.where ?? {};
        return members.filter((m) =>
          Object.entries(where).every(([k, v]) => (m as any)[k] === v),
        );
      },
    },
  };
  return { db, workspaces, members };
}

test("invite role asing ditolak; role valid lolos", async () => {
  const { db } = createMockDb();
  const svc = new WorkspaceService(db as any);
  const ws = await svc.createWorkspace({ name: "Studio A" });
  await assert.rejects(
    () => svc.inviteMember({ workspaceId: ws.id, userId: "u1", role: "SuperAdmin" }),
    new RegExp(WORKSPACE_BAD_ROLE.replace(/\./g, "\\.")),
  );
  const m = await svc.inviteMember({
    workspaceId: ws.id,
    userId: "u1",
    role: "PM",
    inviterRole: "Owner",
  });
  assert.equal(m.role, "ADMIN"); // PM dinormalisasi ke matriks F7
});

test("hanya Owner/PM boleh invite; Staff/Finance ditolak", () => {
  assert.equal(canInviteMember("Owner"), true);
  assert.equal(canInviteMember("PM"), true);
  assert.equal(canInviteMember("Staff"), false);
  assert.equal(canInviteMember("Finance"), false);
  assert.equal(toStudioRole("PM"), "Admin");
  assert.equal(toStudioRole("Staff"), "Viewer");
});

test("invite oleh Staff = forbidden meski role target valid", async () => {
  const { db } = createMockDb();
  const svc = new WorkspaceService(db as any);
  const ws = await svc.createWorkspace({ name: "Studio B" });
  await assert.rejects(
    () =>
      svc.inviteMember({ workspaceId: ws.id, userId: "u2", role: "Staff", inviterRole: "Staff" }),
    new RegExp(WORKSPACE_FORBIDDEN.replace(/\./g, "\\.")),
  );
});

test("createWorkspace nama kosong ditolak; listMembers per workspace", async () => {
  const { db } = createMockDb();
  const svc = new WorkspaceService(db as any);
  await assert.rejects(() => svc.createWorkspace({ name: "  " }), /empty_name/);
  const ws = await svc.createWorkspace({ name: "Studio C", plan: "STUDIO" });
  assert.equal(ws.plan, "STUDIO");
  await svc.inviteMember({ workspaceId: ws.id, userId: "u1", role: "Owner" });
  await svc.inviteMember({ workspaceId: ws.id, userId: "u2", role: "Finance" });
  assert.equal((await svc.listMembers(ws.id)).length, 2);
  assert.equal((await svc.listMembers("lain")).length, 0);
});

test("moveProject tercatat di mapping in-memory (TODO kolom DB)", async () => {
  __clearWorkspaceProjects();
  const { db } = createMockDb();
  const svc = new WorkspaceService(db as any);
  assert.equal(svc.getProjectWorkspace("p1"), null);
  await svc.moveProject("p1", "w1");
  await svc.moveProject("p2", "w1");
  await svc.moveProject("p3", "w2");
  assert.equal(svc.getProjectWorkspace("p1"), "w1");
  assert.deepEqual(listWorkspaceProjects("w1").sort(), ["p1", "p2"]);
  assert.deepEqual(listWorkspaceProjects("w2"), ["p3"]);
  assert.throws(() => moveProjectToWorkspace("", "w1"), /missing_scope/);
  assert.equal(getProjectWorkspace("tak-ada"), null);
  __clearWorkspaceProjects();
});

test("workload: task aktif + tiket se-project; overload di threshold", () => {
  const tasks = [
    { assignee: "budi", status: "DOING", project_id: "p1" },
    { assignee: "budi", status: "TODO", project_id: "p1" },
    { assignee: "budi", status: "DONE", project_id: "p1" }, // selesai tak dihitung
    { assignee: "ani", status: "TODO", project_id: "p2" },
  ];
  const tickets = [
    { project_id: "p1", status: "OPEN" },
    { project_id: "p1", status: "IN_PROGRESS" },
    { project_id: "p1", status: "RESOLVED" }, // terminal tak dihitung
    { project_id: "p2", status: "OPEN" },
  ];
  const [budi, ani] = summarizeWorkload(tasks, tickets, {
    staffIds: ["budi", "ani"],
    threshold: 4,
  });
  assert.deepEqual(budi, { staffId: "budi", taskCount: 2, ticketCount: 2, total: 4, overloaded: true });
  assert.deepEqual(ani, { staffId: "ani", taskCount: 1, ticketCount: 1, total: 2, overloaded: false });
});
