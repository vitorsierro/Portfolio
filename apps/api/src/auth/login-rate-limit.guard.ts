import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request, Response } from 'express';

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, { count: number; until: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (window.until <= now) this.windows.delete(key);
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const account = createHash('sha256').update(email).digest('hex');
    for (const [key, limit, duration] of [
      [`ip:${req.ip}`, 10, 60_000],
      [`account:${account}`, 50, 15 * 60_000],
    ] as const) {
      let window = this.windows.get(key);
      if (!window) {
        if (this.windows.size >= 10_000) {
          res.setHeader('Retry-After', '60');
          throw new HttpException('Tente novamente mais tarde', HttpStatus.TOO_MANY_REQUESTS);
        }
        window = { count: 0, until: now + duration };
        this.windows.set(key, window);
      }
      if (++window.count > limit) {
        res.setHeader('Retry-After', String(Math.ceil((window.until - now) / 1000)));
        throw new HttpException('Tente novamente mais tarde', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    return true;
  }
}
