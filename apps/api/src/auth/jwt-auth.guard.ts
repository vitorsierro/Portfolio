import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; email: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length);

    try {
      req.user = await this.jwt.verifyAsync<{ sub: string; email: string }>(
        token,
        { secret: process.env.JWT_ACCESS_SECRET },
      );
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
