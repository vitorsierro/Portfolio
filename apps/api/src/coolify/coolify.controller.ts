import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoolifyService } from './coolify.service';

@Controller('admin/coolify')
@UseGuards(JwtAuthGuard)
export class CoolifyController {
  constructor(private readonly coolify: CoolifyService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  overview() {
    return this.coolify.getOverview();
  }
}
