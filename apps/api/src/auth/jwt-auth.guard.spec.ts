import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionService } from './session.service';

function contextWith(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
  const sessions = { findById: jest.fn() };
  const guard = new JwtAuthGuard(jwt, sessions as unknown as SessionService);

  beforeEach(() => jest.clearAllMocks());

  it('throws without a bearer token', async () => {
    await expect(guard.canActivate(contextWith({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows a valid token and attaches the user', async () => {
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'a1',
      email: 'a@b.c',
      sid: 's1',
    });
    sessions.findById.mockResolvedValue({ adminId: 'a1', expiresAt: new Date(Date.now() + 60000) });
    const ctx = contextWith({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws on an invalid token', async () => {
    (jwt.verifyAsync as jest.Mock).mockRejectedValue(new Error('bad'));

    await expect(
      guard.canActivate(contextWith({ authorization: 'Bearer bad' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a valid JWT after its session has been revoked', async () => {
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'a1', sid: 's1' });
    sessions.findById.mockResolvedValue(null);
    await expect(guard.canActivate(contextWith({ authorization: 'Bearer stolen' })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
