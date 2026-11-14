import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionService } from './session.service';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, SessionService, LoginRateLimitGuard],
  exports: [JwtAuthGuard, JwtModule, SessionService],
})
export class AuthModule {}
