import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AiMemoryModule } from './ai-memory/ai-memory.module';
import { EnseadaModule } from './enseada/enseada.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AiMemoryModule,
    PostsModule,
    PortfolioModule,
    EnseadaModule,
  ],
})
export class AppModule {}
