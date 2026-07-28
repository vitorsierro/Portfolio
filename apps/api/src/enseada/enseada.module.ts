import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnseadaAdminController } from './admin.controller';
import { ContentTokenGuard } from './content-token.guard';
import { EnseadaService } from './enseada.service';
import { PublicContentController } from './public.controller';
import { UploadController } from './upload/upload.controller';
import { UploadService } from './upload/upload.service';

@Module({
  imports: [AuthModule],
  controllers: [
    PublicContentController,
    EnseadaAdminController,
    UploadController,
  ],
  providers: [EnseadaService, UploadService, ContentTokenGuard],
})
export class EnseadaModule {}
