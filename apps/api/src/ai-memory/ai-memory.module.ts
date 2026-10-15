import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiMemoryController } from './ai-memory.controller';
import { AiMemoryService } from './ai-memory.service';

@Module({
  imports: [AuthModule],
  controllers: [AiMemoryController],
  providers: [AiMemoryService],
})
export class AiMemoryModule {}
