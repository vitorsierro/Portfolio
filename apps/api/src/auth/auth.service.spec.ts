import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = { admin: { findUnique: jest.fn(), update: jest.fn() } };
  const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('issues tokens and stores a refresh hash on valid credentials', async () => {
    const passwordHash = await bcrypt.hash('secret123', 4);
    prisma.admin.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'a@b.c',
      passwordHash,
    });
    jwt.signAsync.mockResolvedValue('token');
    prisma.admin.update.mockResolvedValue({});

    const res = await service.login('a@b.c', 'secret123');

    expect(res).toEqual({
      accessToken: 'token',
      refreshToken: 'token',
      adminId: 'a1',
    });
    // refresh hash persisted
    expect(prisma.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' } }),
    );
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
});
