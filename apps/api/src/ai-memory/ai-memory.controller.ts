import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiMemoryService } from './ai-memory.service';

@Controller('admin/ai-memory')
@UseGuards(JwtAuthGuard)
export class AiMemoryController {
  constructor(private readonly aiMemoryService: AiMemoryService) {}

  @Get()
  getOverview() {
    return this.aiMemoryService.getOverview();
  }
}
