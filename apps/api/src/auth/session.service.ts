import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Sliding 7-day expiry, capped at 30 days from creation — even a session used
// daily eventually forces a fresh login. Kept as constants (not env) since
// they're a deliberate, fixed security decision rather than a deployment knob.
const SLIDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
  async verify(token: string | undefined): Promise<{ adminId: string } | null> {
    if (!token) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!session || session.expiresAt <= new Date()) {
      return null;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return { adminId: session.adminId };
  }

  findById(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
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
    await this.prisma.session
      .delete({ where: { id } })
      .catch(() => undefined); // already gone — logout is idempotent
  }

  async revokeByToken(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    await this.prisma.session
      .delete({ where: { tokenHash: this.hash(token) } })
      .catch(() => undefined);
  }

  private newToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
