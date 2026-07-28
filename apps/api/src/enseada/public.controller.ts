import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ContentTokenGuard } from './content-token.guard';
import { EnseadaService } from './enseada.service';

@Controller('public/enseada')
@UseGuards(ContentTokenGuard)
export class PublicContentController {
  constructor(private readonly enseada: EnseadaService) {}

  // O site consome isto em build time e revalida por ISR. O cache de 5min
  // absorve rajadas de revalidação sem martelar o SQLite.
  @Get('content')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  getContent() {
    return this.enseada.getContent();
  }
}
