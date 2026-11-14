import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoolifyController } from './coolify.controller';
import { CoolifyService } from './coolify.service';

@Module({
  imports: [AuthModule],
  controllers: [CoolifyController],
  providers: [CoolifyService],
})
export class CoolifyModule {}
