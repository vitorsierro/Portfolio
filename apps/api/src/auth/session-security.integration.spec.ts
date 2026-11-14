import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { SessionService } from './session.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('Revogação e concorrência com SQLite real', () => {
  let directory: string;
  let prisma: PrismaClient;
  let sessions: SessionService;
  let adminId: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'portfolio-auth-'));
    writeFileSync(join(directory, 'test.db'), '');
    const url = `file:${join(directory, 'test.db').replace(/\\/g, '/')}`;
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: resolve(__dirname, '../..'), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
    });
    prisma = new PrismaClient({ datasources: { db: { url } } });
    adminId = (await prisma.admin.create({ data: { email: 'auth@test.local', passwordHash: 'test-only' } })).id;
    sessions = new SessionService(prisma as never);
  }, 30000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (directory && resolve(directory).startsWith(resolve(tmpdir(), 'portfolio-auth-'))) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('somente uma requisição consome o refresh token em paralelo', async () => {
    const session = await sessions.create(adminId);
    await sessions.setRefreshHash(session.id, 'refresh');
    const results = await Promise.all([
      sessions.consumeRefreshToken(session.id, 'refresh'),
      sessions.consumeRefreshToken(session.id, 'refresh'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await sessions.consumeRefreshToken(session.id, 'refresh')).toBe(false);
  });

  it('logout invalida imediatamente um access JWT ainda não expirado', async () => {
    const session = await sessions.create(adminId);
    const previous = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'integration-test-only';
    try {
      const jwt = new JwtService();
      const token = await jwt.signAsync({ sub: adminId, sid: session.id }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' });
      const context = { switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }) } as unknown as ExecutionContext;
      const guard = new JwtAuthGuard(jwt, sessions);
      await expect(guard.canActivate(context)).resolves.toBe(true);
      await sessions.revokeById(session.id);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      if (previous === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = previous;
    }
  });
});
