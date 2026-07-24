import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Sliding 7-day expiry, capped at 30 days from creation — even a session used
// daily eventually forces a fresh login. Kept as constants (not env) since
// they're a deliberate, fixed security decision rather than a deployment knob.
const SLIDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

// Opaque session used by the nginx forward-auth check (/auth/verify) to gate
// the self-hosted tools (Excalidraw, OpenClaw). Deliberately not a JWT: since
// verification already has to hit the DB to support revocation, a JWT would
// add forgeable surface without removing the DB round-trip.
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(adminId: string): Promise<IssuedSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SLIDING_TTL_MS);

    await this.prisma.session.create({
      data: { adminId, tokenHash: this.hash(token), expiresAt },
    });

    return { token, expiresAt };
  }

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

  // Extends a still-valid session's sliding window, unless it has hit the
  // absolute age cap — in which case the caller should fall back to issue().
  async renew(token: string | undefined): Promise<IssuedSession | null> {
    if (!token) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!session || session.expiresAt <= new Date()) {
      return null;
    }
    if (Date.now() - session.createdAt.getTime() > ABSOLUTE_MAX_AGE_MS) {
      await this.prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    const newToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SLIDING_TTL_MS);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: this.hash(newToken),
        expiresAt,
        lastSeenAt: new Date(),
      },
    });

    return { token: newToken, expiresAt };
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    await this.prisma.session
      .delete({ where: { tokenHash: this.hash(token) } })
      .catch(() => undefined); // already gone — logout is idempotent
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
