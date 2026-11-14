import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { SessionService } from './session.service';

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; email: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length);

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; sid: string }>(
        token,
        { secret: process.env.JWT_ACCESS_SECRET },
      );
      const session = payload.sid ? await this.sessions.findById(payload.sid) : null;
      if (!session || session.adminId !== payload.sub || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Session revoked');
      }
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
