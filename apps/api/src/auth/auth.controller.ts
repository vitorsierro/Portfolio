import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const { accessToken, refreshToken } = await this.authService.login(
      dto.email,
      dto.password,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const { accessToken, refreshToken } = await this.authService.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return { success: true };
  }

  private setRefreshCookie(res: Response, token: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/auth',
      maxAge: REFRESH_MAX_AGE,
    });
  }
}
