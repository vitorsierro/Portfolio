import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

// Dublês de Request/Response do Express com só o que o controller usa. O
// `unknown` intermediário evita `any` sem fingir que o objeto é completo.
function mockReq(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

function mockRes(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    headers,
  } as unknown as Response & { headers: Record<string, string> };
}

describe('AuthController /auth/verify', () => {
  let controller: AuthController;
  const authService = { login: jest.fn(), refresh: jest.fn(), logout: jest.fn() };
  const sessionService = { issue: jest.fn(), verify: jest.fn(), renew: jest.fn(), revoke: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('resolves (204, never a redirect) with X-Auth-User when the session is valid', async () => {
    sessionService.verify.mockResolvedValue({ adminId: 'admin1' });
    const res = mockRes();

    await controller.verify(mockReq({ admin_session: 'good-token' }), res);

    expect(res.setHeader).toHaveBeenCalledWith('X-Auth-User', 'admin1');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('throws 401 (not a redirect) when there is no valid session', async () => {
    sessionService.verify.mockResolvedValue(null);

    await expect(
      controller.verify(mockReq(), mockRes()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('passes the admin_session cookie value through to SessionService.verify', async () => {
    sessionService.verify.mockResolvedValue({ adminId: 'admin1' });

    await controller.verify(mockReq({ admin_session: 'the-cookie' }), mockRes());

    expect(sessionService.verify).toHaveBeenCalledWith('the-cookie');
  });
});
