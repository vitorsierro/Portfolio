import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  sessionToken: string;
  sessionExpiresAt: Date;
}

interface RefreshPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
  ) {}

  async login(email: string, password: string): Promise<AuthResult> {
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Each login gets its own row, so signing in on a second device (or tab)
    // leaves the first one working.
    const session = await this.sessions.create(admin.id);
    return this.issueFor(admin.id, admin.email, session);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // The session id travels in the token, so rotation touches only the row
    // belonging to THIS browser.
    const session = payload.sid
      ? await this.sessions.findById(payload.sid)
      : null;

    if (
      !session ||
      session.adminId !== payload.sub ||
      session.expiresAt <= new Date() ||
      !this.sessions.matchesRefreshHash(session.refreshTokenHash, refreshToken)
    ) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    if (this.sessions.hasExceededMaxAge(session.createdAt)) {
      await this.sessions.revokeById(session.id);
      throw new UnauthorizedException('Session expired');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: session.adminId },
    });
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const rotated = await this.sessions.rotateToken(session.id);
    return this.issueFor(admin.id, admin.email, rotated);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      if (payload.sid) {
        // Ends only this browser's session; other devices stay signed in.
        await this.sessions.revokeById(payload.sid);
      }
    } catch {
      // Token already invalid — nothing to revoke.
    }
  }

  private async issueFor(
    adminId: string,
    email: string,
    session: { id: string; token: string; expiresAt: Date },
  ): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({ sub: adminId, email }, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.ACCESS_TOKEN_TTL || '15m',
    } as JwtSignOptions);

    const refreshToken = await this.jwt.signAsync(
      { sub: adminId, sid: session.id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.REFRESH_TOKEN_TTL || '7d',
      } as JwtSignOptions,
    );

    // Only the hash is stored, so a database leak can't replay the token.
    await this.sessions.setRefreshHash(session.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt,
    };
  }
}
