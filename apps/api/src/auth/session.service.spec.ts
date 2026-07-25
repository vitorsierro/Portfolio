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

  it('creates a session row and returns its id and token', async () => {
    prisma.session.create.mockResolvedValue({ id: 's1' });

    const { id, token, expiresAt } = await service.create('admin1');

    expect(id).toBe('s1');
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
      lastSeenAt: new Date(),
    });

    await expect(service.verify('some-token')).resolves.toEqual({
      adminId: 'admin1',
    });
  });

  it('does not write lastSeenAt on every check', async () => {
    // nginx chama isto para cada asset; escrever sempre serializaria o SQLite
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      adminId: 'admin1',
      expiresAt: new Date(Date.now() + 1000),
      lastSeenAt: new Date(), // acabou de ser visto
    });

    await service.verify('token');

    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it('refreshes lastSeenAt once the throttle window passes', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      adminId: 'admin1',
      expiresAt: new Date(Date.now() + 1000),
      lastSeenAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min atrás
    });
    prisma.session.update.mockResolvedValue({});

    await service.verify('token');

    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    );
  });

  it('rejects unknown, expired and missing tokens', async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(service.verify('nope')).resolves.toBeNull();

    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      adminId: 'admin1',
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.verify('expired')).resolves.toBeNull();

    await expect(service.verify(undefined)).resolves.toBeNull();
  });

  it('rotates the tool token without dropping the row', async () => {
    prisma.session.update.mockResolvedValue({});

    const rotated = await service.rotateToken('s1');

    expect(rotated.id).toBe('s1');
    expect(rotated.token).toHaveLength(43);
    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    );
  });

  it('matches a refresh hash only when it corresponds to the token', async () => {
    prisma.session.update.mockResolvedValue({});
    await service.setRefreshHash('s1', 'the-token');

    const stored = prisma.session.update.mock.calls[0][0].data.refreshTokenHash;

    expect(service.matchesRefreshHash(stored, 'the-token')).toBe(true);
    expect(service.matchesRefreshHash(stored, 'another-token')).toBe(false);
    expect(service.matchesRefreshHash(null, 'the-token')).toBe(false);
  });

  it('flags sessions past the absolute age cap', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

    expect(service.hasExceededMaxAge(thirtyOneDaysAgo)).toBe(true);
    expect(service.hasExceededMaxAge(new Date())).toBe(false);
  });

  it('revoking is idempotent', async () => {
    prisma.session.delete.mockRejectedValue(new Error('not found'));

    await expect(service.revokeById('gone')).resolves.toBeUndefined();
    await expect(service.revokeByToken('gone')).resolves.toBeUndefined();

    prisma.session.delete.mockClear();
    await service.revokeByToken(undefined);
    expect(prisma.session.delete).not.toHaveBeenCalled();
  });
});
