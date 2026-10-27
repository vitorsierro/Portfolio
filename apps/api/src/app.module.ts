import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { AiMemoryModule } from './ai-memory/ai-memory.module';
import { EnseadaModule } from './enseada/enseada.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { FinanceModule } from './finance/finance.module';
import { ThreadsModule } from './threads/threads.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AiMemoryModule,
    PostsModule,
    PortfolioModule,
    EnseadaModule,
    FinanceModule,
    ThreadsModule,
  ],
})
export class AppModule {}
