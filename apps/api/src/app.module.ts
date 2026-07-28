import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EnseadaModule } from './enseada/enseada.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PostsModule,
    PortfolioModule,
    EnseadaModule,
  ],
})
export class AppModule {}
