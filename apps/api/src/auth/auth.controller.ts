import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { OriginCheckGuard } from './origin-check.guard';
import { SessionService } from './session.service';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// __Secure- requires the Secure attribute, which requires HTTPS — only usable
// once NODE_ENV=production actually serves over TLS.
const isProd = () => process.env.NODE_ENV === 'production';
const SESSION_COOKIE = () =>
  isProd() ? '__Secure-admin_session' : 'admin_session';
// Unset in dev so the cookie stays host-only on localhost; in prod, set to
// e.g. ".vitorsierro.com" so it's shared with the draw./chat. subdomains.
const SESSION_COOKIE_DOMAIN = () => process.env.SESSION_COOKIE_DOMAIN || undefined;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.authService.login(dto.email, dto.password);
    this.setAuthCookies(res, result);
    return { accessToken: result.accessToken };
  }

  @Post('refresh')
  @UseGuards(OriginCheckGuard)
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    // Rotates only this browser's session row, so other tabs/devices keep
    // their own refresh tokens working.
    const result = await this.authService.refresh(token);
    this.setAuthCookies(res, result);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @UseGuards(OriginCheckGuard)
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    // Deleting the session row kills both credentials at once — the CMS
    // refresh token and the tools' cookie.
    await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });

    // Belt and braces: if the refresh cookie was already gone, fall back to
    // revoking by the session cookie we still have.
    const sessionToken = req.cookies?.[SESSION_COOKIE()] as string | undefined;
    await this.sessionService.revokeByToken(sessionToken);
    this.clearSessionCookie(res);

    return { success: true };
  }

  // Forward-auth check hit by the nginx auth_request block in front of
  // draw./chat. — must resolve to 2xx or 401 only, never a redirect: the
  // proxy owns the redirect-to-login decision, not the API.
  @Get('verify')
  @HttpCode(204)
  async verify(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');

    const token = req.cookies?.[SESSION_COOKIE()] as string | undefined;
    const session = await this.sessionService.verify(token);
    if (!session) {
      throw new UnauthorizedException();
    }

    res.setHeader('X-Auth-User', session.adminId);
  }

  private setAuthCookies(
    res: Response,
    result: {
      refreshToken: string;
      sessionToken: string;
      sessionExpiresAt: Date;
    },
  ): void {
    this.setRefreshCookie(res, result.refreshToken);
    this.setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/auth',
      maxAge: REFRESH_MAX_AGE,
    });
  }

  private setSessionCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE(), token, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      domain: SESSION_COOKIE_DOMAIN(),
      path: '/',
      expires: expiresAt,
    });
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE(), {
      path: '/',
      domain: SESSION_COOKIE_DOMAIN(),
    });
  }
}
