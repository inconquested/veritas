import assert from 'node:assert/strict';
import test from 'node:test';

import { ShareService, SHARE_NOT_FOUND } from '../services/share-service';

function createMockDb(overrides: Record<string, any> = {}) {
  const calls: Record<string, any[]> = { findUniqueProject: [] };
  const shareRows = overrides.shareRows ?? [];
  const db = {
    project: {
      findUnique: async (q: any) => {
        calls.findUniqueProject.push(q);
        if (overrides.project === undefined) return { id: 'p1' };
        return overrides.project;
      },
    },
    projectShareToken: {
      create: async (q: any) => ({ id: 's1', createdAt: new Date(), ...q.data }),
      findMany: async () => shareRows,
      deleteMany: async () => ({ count: overrides.deleteCount ?? 1 }),
      findUnique: async (q: any) => {
        if (overrides.share !== undefined) return overrides.share;
        if (q.where?.token === 'valid') {
          return { token: 'valid', project_id: 'p1', expiresAt: new Date(Date.now() + 3600_000), scope: 'view' };
        }
        if (q.where?.token === 'expired') {
          return { token: 'expired', project_id: 'p1', expiresAt: new Date(Date.now() - 1000), scope: 'view' };
        }
        return null;
      },
    },
  };
  return { db, calls };
}

test('createShareLink mints a uuid token with default 30d expiry', async () => {
  const { db } = createMockDb();
  const service = new ShareService(db as any);
  const before = Date.now();
  const link = await service.createShareLink('p1');
  assert.match(link.token, /^[0-9a-f-]{36}$/i);
  const ttl = link.expiresAt!.getTime() - before;
  assert.ok(ttl > 29 * 86_400_000 && ttl <= 30 * 86_400_000 + 60_000);
});

test('createShareLink on missing project throws not-found', async () => {
  const { db } = createMockDb({ project: null });
  const service = new ShareService(db as any);
  await assert.rejects(() => service.createShareLink('nope'), new RegExp(SHARE_NOT_FOUND.replace(/\./g, '\\.')));
});

test('getProjectByToken selects whitelist only (no user tables)', async () => {
  const { db, calls } = createMockDb();
  (db.project.findUnique as any) = async (q: any) => {
    calls.findUniqueProject.push(q);
    return { id: 'p1', title: 'T' };
  };
  const service = new ShareService(db as any);
  const result = await service.getProjectByToken('valid');
  assert.equal((result.project as any).id, 'p1');
  const select = calls.findUniqueProject.at(-1).select;
  const flat = JSON.stringify(select);
  assert.ok(!('client' in select) && !('freelancer' in select), 'must not select user relations');
  assert.ok(!flat.includes('email'), 'must not leak emails');
});

test('getProjectByToken expired token throws not-found (404)', async () => {
  const { db } = createMockDb();
  const service = new ShareService(db as any);
  await assert.rejects(() => service.getProjectByToken('expired'), /errors\.share\.not_found/);
});

test('getProjectByToken unknown/revoked token throws not-found (404)', async () => {
  const { db } = createMockDb();
  const service = new ShareService(db as any);
  await assert.rejects(() => service.getProjectByToken('gone'), /errors\.share\.not_found/);
  await assert.rejects(() => service.getProjectByToken(''), /errors\.share\.not_found/);
});

test('revokeShareLink deletes; unknown token throws', async () => {
  const { db } = createMockDb();
  const service = new ShareService(db as any);
  assert.equal(await service.revokeShareLink('valid'), true);

  const revoked = createMockDb({ deleteCount: 0 });
  const service2 = new ShareService(revoked.db as any);
  await assert.rejects(() => service2.revokeShareLink('gone'), /errors\.share\.not_found/);
});
