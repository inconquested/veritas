import assert from 'node:assert/strict';
import test from 'node:test';

import { ProjectService } from '../services/project-service';
import type { CreateProjectInput } from '../schemas';

const mockMedia = {
  uploadMediaMultiple: async () => ['https://example.com/brief.jpg'],
  uploadMediaSingle: async () => 'https://example.com/thumb.jpg',
  deleteMedia: async () => {},
};

function createMockPrisma(overrides: Record<string, any> = {}) {
  const project = {
    create: async () => ({ id: 'p1', title: 'Test', slug: 'test', ...overrides.createResult }),
    findUnique: async (q: any) => {
      if (q.where?.id === 'p1' || q.where?.slug === 'test') return overrides.findResult ?? { id: 'p1', thumb_url: null, brief_image_urls: [] };
      return null;
    },
    findMany: async () => overrides.findManyResult ?? [],
    update: async (q: any) => ({ id: q.where.id, ...q.data }),
    delete: async (q: any) => ({ id: q.where.id }),
    ...overrides.project,
  };
  return {
    project,
    milestone: { createMany: async () => ({ count: 1 }), deleteMany: async () => ({ count: 0 }), update: async () => ({}), create: async () => ({}) },
    handsout: { createMany: async () => ({ count: 1 }), deleteMany: async () => ({ count: 0 }), update: async () => ({}), create: async () => ({}) },
    $transaction: async (cb: any) => cb({
      project,
      milestone: project.milestone ?? { createMany: async () => ({ count: 1 }), deleteMany: async () => ({ count: 0 }), update: async () => ({}), create: async () => ({}) },
      handsout: project.handsout ?? { createMany: async () => ({ count: 1 }), deleteMany: async () => ({ count: 0 }), update: async () => ({}), create: async () => ({}) },
    }),
  };
}

test('createProject succeeds with valid input and ctx', async () => {
  const mock = createMockPrisma();
  const service = new ProjectService(mock as any, mockMedia as any);
  const input: CreateProjectInput = {
    title: 'Test Project',
    slug: 'test',
    description: 'A test project',
  };
  const result = await service.createProject(input, { freelancerId: 'f1', clientId: 'c1' });
  assert.equal(result.title, 'Test');
});

test('createProject throws on missing freelancerId in ctx', async () => {
  const mock = createMockPrisma();
  const service = new ProjectService(mock as any, mockMedia as any);
  try {
    await service.createProject({ title: 'T', slug: 't' }, { freelancerId: '', clientId: 'c1' });
    assert.fail('Should throw');
  } catch (error) {
    assert.match((error as Error).message, /missing_user|freelancer/i);
  }
});

test('getProjectById throws on empty ID', async () => {
  const service = new ProjectService();
  try {
    await service.getProjectById('');
    assert.fail('Should throw');
  } catch (error) {
    assert.match((error as Error).message, /required/i);
  }
});

test('getProjectById returns project via mock', async () => {
  const mock = createMockPrisma({
    findResult: { id: 'p1', thumb_url: null, brief_image_urls: [], freelancer: {}, client: {}, milestones: [], invoices: [], handsouts: [] },
  });
  const service = new ProjectService(mock as any, mockMedia as any);
  const result = await service.getProjectById('p1');
  assert.equal(result.id, 'p1');
});

test('getProjectBySlug throws on empty slug', async () => {
  const service = new ProjectService();
  try {
    await service.getProjectBySlug('');
    assert.fail('Should throw');
  } catch (error) {
    assert.match((error as Error).message, /required/i);
  }
});

test('updateProject throws on empty ID', async () => {
  const service = new ProjectService();
  try {
    await service.updateProject('', { title: 'Updated' });
    assert.fail('Should throw');
  } catch (error) {
    assert.match((error as Error).message, /required/i);
  }
});

test('updateProject throws on not-found project', async () => {
  const mock = createMockPrisma({ findResult: null });
  const service = new ProjectService(mock as any, mockMedia as any);
  try {
    await service.updateProject('missing', { title: 'Updated' });
    assert.fail('Should throw');
  } catch (error) {
    assert.equal((error as Error).message, 'errors.notExist');
  }
});

test('deleteProject throws on empty ID', async () => {
  const service = new ProjectService();
  try {
    await service.deleteProject('');
    assert.fail('Should throw');
  } catch (error) {
    assert.match((error as Error).message, /required/i);
  }
});

test('deleteProject returns true on success via mock', async () => {
  const mock = createMockPrisma({ findResult: { thumb_url: null } });
  const service = new ProjectService(mock as any, mockMedia as any);
  const result = await service.deleteProject('p1');
  assert.equal(result, true);
});

test('DI constructor accepts custom prisma and media', () => {
  const mock = createMockPrisma();
  const service = new ProjectService(mock as any, mockMedia as any);
  assert.equal((service as any).db, mock);
  assert.equal((service as any).media, mockMedia);
});

test('DI constructor defaults to global singletons', () => {
  const service = new ProjectService();
  assert.ok((service as any).db);
  assert.ok((service as any).media);
});
