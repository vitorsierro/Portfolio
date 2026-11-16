import { Body, Controller, Module, Post, UseGuards } from '@nestjs/common';
import { IsString, IsUrl, MaxLength } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { NewsService } from './news.service';

export class ImportNewsDto {
  @IsString()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  sourceUrl!: string;
}
@Controller('admin/news')
@UseGuards(JwtAuthGuard)
export class NewsController {
  constructor(private readonly news: NewsService) {}
  @Post('import')
  importArticle(@Body() body: ImportNewsDto) { return this.news.importArticle(body.sourceUrl); }
}
@Module({ imports: [PrismaModule, AuthModule], controllers: [NewsController], providers: [NewsService] })
export class NewsModule {}
