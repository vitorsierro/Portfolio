import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

// Protege o endpoint público de conteúdo. Token estático compartilhado com o
// site-enseada — separado do JWT do admin de propósito: são credenciais com
// donos e ciclos de vida diferentes, e vazar uma não pode comprometer a outra.
@Injectable()
export class ContentTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ENSEADA_CONTENT_TOKEN;
    // Sem token configurado, nega: um deploy incompleto não deve resultar em
    // endpoint aberto.
    if (!expected) {
      throw new UnauthorizedException('Conteúdo indisponível');
    }

    const header = context.switchToHttp().getRequest<Request>().headers
      .authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }

    if (!this.matches(header.slice('Bearer '.length), expected)) {
      throw new UnauthorizedException('Token inválido');
    }
    return true;
  }

  // Comparação de tempo constante: `===` vaza, pelo tempo de resposta, quantos
  // caracteres iniciais estavam certos, o que permite descobrir o token byte a
  // byte.
  private matches(received: string, expected: string): boolean {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }
}
