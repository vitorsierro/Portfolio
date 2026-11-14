import { ExecutionContext, HttpException } from '@nestjs/common';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

function context(ip: string, email = 'admin@example.com'): ExecutionContext {
  return { switchToHttp: () => ({
    getRequest: () => ({ ip, body: { email } }),
    getResponse: () => ({ setHeader: jest.fn() }),
  }) } as unknown as ExecutionContext;
}

describe('Limitação de login', () => {
  it('bloqueia o mesmo IP mesmo trocando a conta', () => {
    const guard = new LoginRateLimitGuard();
    for (let i = 0; i < 10; i++) expect(guard.canActivate(context('192.0.2.1', `${i}@example.com`))).toBe(true);
    expect(() => guard.canActivate(context('192.0.2.1'))).toThrow(HttpException);
  });

  it('bloqueia ataques distribuídos contra a mesma conta e normaliza caixa', () => {
    const guard = new LoginRateLimitGuard();
    for (let i = 0; i < 50; i++) guard.canActivate(context(`192.0.2.${i}`, 'ADMIN@example.com'));
    expect(() => guard.canActivate(context('198.51.100.1', 'admin@example.com'))).toThrow(HttpException);
  });

  it('libera tentativas após expirar a janela', () => {
    jest.useFakeTimers();
    try {
      const guard = new LoginRateLimitGuard();
      for (let i = 0; i < 10; i++) guard.canActivate(context('192.0.2.1'));
      jest.advanceTimersByTime(60001);
      expect(guard.canActivate(context('192.0.2.1'))).toBe(true);
    } finally { jest.useRealTimers(); }
  });
});
