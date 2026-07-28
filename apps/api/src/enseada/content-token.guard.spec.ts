import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ContentTokenGuard } from './content-token.guard';

function contextWith(authorization?: string): ExecutionContext {
  const req = { headers: authorization ? { authorization } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ContentTokenGuard', () => {
  const guard = new ContentTokenGuard();
  const original = process.env.ENSEADA_CONTENT_TOKEN;

  beforeEach(() => {
    process.env.ENSEADA_CONTENT_TOKEN = 'token-secreto-de-teste';
  });

  afterAll(() => {
    process.env.ENSEADA_CONTENT_TOKEN = original;
  });

  it('aceita o token correto', () => {
    expect(guard.canActivate(contextWith('Bearer token-secreto-de-teste'))).toBe(
      true,
    );
  });

  it('rejeita token ausente, mal formado ou errado', () => {
    for (const header of [
      undefined,
      'token-secreto-de-teste', // sem o prefixo Bearer
      'Bearer errado',
      'Bearer ',
    ]) {
      expect(() => guard.canActivate(contextWith(header))).toThrow(
        UnauthorizedException,
      );
    }
  });

  it('rejeita um token que é prefixo do correto', () => {
    // Comprimentos diferentes precisam falhar antes do timingSafeEqual, que
    // lança se os buffers não tiverem o mesmo tamanho.
    expect(() => guard.canActivate(contextWith('Bearer token-secreto'))).toThrow(
      UnauthorizedException,
    );
  });

  it('nega quando o servidor não tem token configurado', () => {
    // Deploy incompleto não pode resultar em endpoint aberto.
    delete process.env.ENSEADA_CONTENT_TOKEN;

    expect(() => guard.canActivate(contextWith('Bearer qualquer'))).toThrow(
      UnauthorizedException,
    );
  });
});
