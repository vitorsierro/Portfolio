import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(admin.id, admin.email);
  }

  async refresh(refreshToken: string | undefined): Promise<TokenPair> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
    });
    if (
      !admin ||
      !admin.refreshTokenHash ||
      this.hashToken(refreshToken) !== admin.refreshTokenHash
    ) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    return this.issueTokens(admin.id, admin.email);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      await this.prisma.admin.update({
        where: { id: payload.sub },
        data: { refreshTokenHash: null },
      });
    } catch {
      // Token already invalid — nothing to revoke.
    }
  }

  private async issueTokens(sub: string, email: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub, email }, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.ACCESS_TOKEN_TTL || '15m',
    } as JwtSignOptions);
    const refreshToken = await this.jwt.signAsync({ sub }, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.REFRESH_TOKEN_TTL || '7d',
    } as JwtSignOptions);

    // Store only a hash of the refresh token so a DB leak can't reuse it.
    // Refresh tokens are high-entropy JWTs, so sha256 is sufficient and avoids
    // bcrypt's 72-byte truncation on long inputs.
    await this.prisma.admin.update({
      where: { id: sub },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
