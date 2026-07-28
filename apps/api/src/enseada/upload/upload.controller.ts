import {
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UploadService, UploadedImage } from './upload.service';

@Controller('admin/enseada/upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder = 'geral',
  ): Promise<UploadedImage> {
    // Slug simples na pasta: o valor vai para o caminho no Cloudinary.
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, '') || 'geral';
    return this.uploadService.upload(file, safeFolder);
  }
}
