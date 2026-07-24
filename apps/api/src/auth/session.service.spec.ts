import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  const prisma = {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [SessionService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('issues a session token and persists its hash', async () => {
    prisma.session.create.mockResolvedValue({});

    const { token, expiresAt } = await service.issue('admin1');

    expect(token).toHaveLength(43); // base64url of 32 random bytes
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adminId: 'admin1' }),
      }),
    );
  });

  it('verifies a valid, unexpired token', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      adminId: 'admin1',
      expiresAt: new Date(Date.now() + 1000),
    });
    prisma.session.update.mockResolvedValue({});

    const result = await service.verify('some-token');

    expect(result).toEqual({ adminId: 'admin1' });
    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    );
  });

  it('rejects an unknown token', async () => {
    prisma.session.findUnique.mockResolvedValue(null);

    await expect(service.verify('nope')).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      adminId: 'admin1',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.verify('expired')).resolves.toBeNull();
  });

  it('returns null when no token is provided', async () => {
    await expect(service.verify(undefined)).resolves.toBeNull();
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });

  it('renews a valid session with a fresh token', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      adminId: 'admin1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });
    prisma.session.update.mockResolvedValue({});

    const result = await service.renew('old-token');

    expect(result).not.toBeNull();
    expect(result!.token).toHaveLength(43);
    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    );
  });

  it('forces re-login when a session exceeds the absolute age cap', async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      adminId: 'admin1',
      createdAt: thirtyOneDaysAgo,
      expiresAt: new Date(Date.now() + 1000),
    });
    prisma.session.delete.mockResolvedValue({});

    const result = await service.renew('stale-token');

    expect(result).toBeNull();
    expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('revoke() is idempotent when the session is already gone', async () => {
    prisma.session.delete.mockRejectedValue(new Error('not found'));

    await expect(service.revoke('gone')).resolves.toBeUndefined();
  });

  it('revoke() is a no-op when no token is provided', async () => {
    await service.revoke(undefined);

    expect(prisma.session.delete).not.toHaveBeenCalled();
  });
});
