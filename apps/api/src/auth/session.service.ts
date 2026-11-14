import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { EventEmitter } from 'node:events';
import { Observable, shareReplay } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

// Sliding 7-day expiry, capped at 30 days from creation — even a session used
// daily eventually forces a fresh login. Kept as constants (not env) since
// they're a deliberate, fixed security decision rather than a deployment knob.
const SLIDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// nginx chama /auth/verify uma vez por REQUISIÇÃO — inclusive cada asset de
// uma página. Gravar lastSeenAt em todas elas serializa escritas no SQLite
// sem necessidade; o campo é informativo, precisão de minutos basta.
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export interface IssuedSession {
  id: string;
  token: string;
  expiresAt: Date;
}

// One row per signed-in browser, holding both the opaque tool-session cookie
// and that browser's CMS refresh token. Per-row (rather than a single column
// on Admin) is what lets tabs and devices coexist: a global hash meant each
// new login or refresh silently logged everything else out.
@Injectable()
export class SessionService {
  private readonly revocations = new EventEmitter();
  private readonly socketWatches = new Map<string, Observable<{ type: string; data: string }>>();
  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string): Promise<IssuedSession> {
    const token = this.newToken();
    const expiresAt = new Date(Date.now() + SLIDING_TTL_MS);

    const session = await this.prisma.session.create({
      data: { adminId, tokenHash: this.hash(token), expiresAt },
    });

    return { id: session.id, token, expiresAt };
  }

  // Used by the nginx forward-auth check (GET /auth/verify).
  async verify(token: string | undefined): Promise<{ adminId: string; sessionId: string } | null> {
    if (!token) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!session || session.expiresAt <= new Date()) {
      return null;
    }

    if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return { adminId: session.adminId, sessionId: session.id };
  }

  socketTicket(id: string): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new UnauthorizedException();
    return `${id}.${createHmac('sha256', secret).update(`tool-socket-watch:${id}`).digest('hex')}`;
  }

  watchSocketSession(ticket: string): Observable<{ type: string; data: string }> {
    const [id, signature, extra] = ticket.split('.');
    if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || !signature || !/^[a-f0-9]{64}$/.test(signature) || extra) {
      throw new UnauthorizedException();
    }
    const expected = this.socketTicket(id).split('.')[1];
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new UnauthorizedException();
    const existing = this.socketWatches.get(id);
    if (existing) return existing;

    const watch = new Observable<{ type: string; data: string }>((subscriber) => {
      let checking = false;
      let ready = false;
      const revoke = () => {
        subscriber.next({ type: 'revoked', data: 'revoked' });
        subscriber.complete();
      };
      // Assinar antes de consultar o banco evita a corrida com o logout.
      this.revocations.on(id, revoke);
      const check = async () => {
        if (checking || subscriber.closed) return;
        checking = true;
        try {
          const session = await this.findById(id);
          if (subscriber.closed) return;
          if (!session || session.expiresAt <= new Date()) return revoke();
          subscriber.next({ type: ready ? 'heartbeat' : 'ready', data: 'active' });
          ready = true;
        } catch (error) {
          subscriber.error(error);
        } finally { checking = false; }
      };
      void check();
      // Também cobre expiração e revogação feita diretamente no banco.
      const timer = setInterval(() => { void check(); }, 500);
      timer.unref();
      return () => {
        clearInterval(timer);
        this.revocations.off(id, revoke);
        this.socketWatches.delete(id);
      };
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.socketWatches.set(id, watch);
    return watch;
  }

  findById(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async consumeRefreshToken(id: string, token: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id, refreshTokenHash: this.hash(token), expiresAt: { gt: new Date() } },
      data: { refreshTokenHash: null },
    });
    return result.count === 1;
  }

  // Records the hash of the refresh token currently valid for this session.
  async setRefreshHash(id: string, refreshToken: string): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { refreshTokenHash: this.hash(refreshToken) },
    });
  }

  matchesRefreshHash(storedHash: string | null, refreshToken: string): boolean {
    return !!storedHash && storedHash === this.hash(refreshToken);
  }

  hasExceededMaxAge(createdAt: Date): boolean {
    return Date.now() - createdAt.getTime() > ABSOLUTE_MAX_AGE_MS;
  }

  // Issues a fresh tool-session cookie for an existing row, extending the
  // sliding window. The row (and therefore other tabs' refresh tokens) stays
  // intact.
  async rotateToken(id: string): Promise<IssuedSession> {
    const token = this.newToken();
    const expiresAt = new Date(Date.now() + SLIDING_TTL_MS);

    await this.prisma.session.update({
      where: { id },
      data: { tokenHash: this.hash(token), expiresAt, lastSeenAt: new Date() },
    });

    return { id, token, expiresAt };
  }

  async revokeById(id: string): Promise<void> {
    try {
      await this.prisma.session.delete({ where: { id } });
    } catch (error) {
      if (!this.isMissingRow(error)) throw error;
    }
    this.revocations.emit(id);
  }

  async revokeByToken(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    try {
      const session = await this.prisma.session.delete({ where: { tokenHash: this.hash(token) } });
      if (session) this.revocations.emit(session.id);
    } catch (error) {
      if (!this.isMissingRow(error)) throw error;
    }
  }

  private isMissingRow(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
  }

  private newToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
