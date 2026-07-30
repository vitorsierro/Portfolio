import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { parseAllowedOrigins } from './allowed-origins';

// Guards cookie-authenticated mutating routes (/auth/refresh, /auth/logout)
// against callers outside the web app. Once the session cookie is scoped to
// .{domain} to reach draw./chat., those tool subdomains become same-site —
// so the browser will happily attach the cookie to a request from a
// compromised tool page even though CORS blocks it from reading the
// response. CORS alone doesn't stop the mutation from executing; this does.
//
// Browsers set an Origin header on every non-GET fetch/XHR (same-origin or
// not), so a real browser request always has one to check. Missing Origin
// only happens for non-browser clients (curl, server-to-server) — allowed
// through since there's no cookie-jar confusion to exploit there.
@Injectable()
export class OriginCheckGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;

    if (!origin || parseAllowedOrigins().includes(origin)) {
      return true;
    }

    throw new ForbiddenException('Origin not allowed');
  }
}
