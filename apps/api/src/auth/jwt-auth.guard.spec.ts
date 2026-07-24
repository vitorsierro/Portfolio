import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWith(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
  const guard = new JwtAuthGuard(jwt);

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
    });
    const ctx = contextWith({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws on an invalid token', async () => {
    (jwt.verifyAsync as jest.Mock).mockRejectedValue(new Error('bad'));

    await expect(
      guard.canActivate(contextWith({ authorization: 'Bearer bad' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
