import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = { admin: { findUnique: jest.fn() } };
  const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const sessions = {
    create: jest.fn(),
    findById: jest.fn(),
    setRefreshHash: jest.fn(),
    matchesRefreshHash: jest.fn(),
    hasExceededMaxAge: jest.fn(),
    rotateToken: jest.fn(),
    revokeById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  const aSession = {
    id: 's1',
    token: 'session-token',
    expiresAt: new Date(Date.now() + 1000),
  };

  it('creates a NEW session row per login, so other devices survive', async () => {
    const passwordHash = await bcrypt.hash('secret123', 4);
    prisma.admin.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'a@b.c',
      passwordHash,
    });
    sessions.create.mockResolvedValue(aSession);
    jwt.signAsync.mockResolvedValue('token');

    const res = await service.login('a@b.c', 'secret123');

    expect(sessions.create).toHaveBeenCalledWith('a1');
    expect(res.accessToken).toBe('token');
    expect(res.sessionToken).toBe('session-token');
    expect(sessions.setRefreshHash).toHaveBeenCalledWith('s1', 'token');
  });

  it('rejects an invalid password', async () => {
    const passwordHash = await bcrypt.hash('secret123', 4);
    prisma.admin.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'a@b.c',
      passwordHash,
    });

    await expect(service.login('a@b.c', 'wrong-pass')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown email', async () => {
    prisma.admin.findUnique.mockResolvedValue(null);

    await expect(service.login('x@y.z', 'whatever1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects refresh when no token is provided', async () => {
    await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates only the session named in the token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'a1', sid: 's1' });
    sessions.findById.mockResolvedValue({
      id: 's1',
      adminId: 'a1',
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 1000),
      createdAt: new Date(),
    });
    sessions.matchesRefreshHash.mockReturnValue(true);
    sessions.hasExceededMaxAge.mockReturnValue(false);
    sessions.rotateToken.mockResolvedValue(aSession);
    prisma.admin.findUnique.mockResolvedValue({ id: 'a1', email: 'a@b.c' });
    jwt.signAsync.mockResolvedValue('token');

    await service.refresh('refresh-token');

    expect(sessions.findById).toHaveBeenCalledWith('s1');
    expect(sessions.rotateToken).toHaveBeenCalledWith('s1');
  });

  it('rejects a refresh token whose hash no longer matches its row', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'a1', sid: 's1' });
    sessions.findById.mockResolvedValue({
      id: 's1',
      adminId: 'a1',
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 1000),
      createdAt: new Date(),
    });
    sessions.matchesRefreshHash.mockReturnValue(false);

    await expect(service.refresh('stale')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token pointing at someone else’s session', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'attacker', sid: 's1' });
    sessions.findById.mockResolvedValue({
      id: 's1',
      adminId: 'a1',
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 1000),
      createdAt: new Date(),
    });
    sessions.matchesRefreshHash.mockReturnValue(true);

    await expect(service.refresh('mismatched')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout revokes only the session in the token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'a1', sid: 's1' });

    await service.logout('refresh-token');

    expect(sessions.revokeById).toHaveBeenCalledWith('s1');
  });
});
