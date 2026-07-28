import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
  blurDataURL: string;
  cloudinaryId: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

@Injectable()
export class UploadService {
  private configured = false;

  private ensureConfigured(): void {
    if (this.configured) {
      return;
    }
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
      process.env;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new InternalServerErrorException(
        'Cloudinary não configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.',
      );
    }

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    this.configured = true;
  }

  async upload(file: Express.Multer.File, folder: string): Promise<UploadedImage> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    // Confia no mimetype só para uma triagem rápida; o Cloudinary rejeita o
    // que não for imagem de verdade ao processar.
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException(
        `Formato não suportado: ${file.mimetype}. Use JPEG, PNG, WebP ou AVIF.`,
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Imagem acima de 10MB');
    }

    this.ensureConfigured();

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `enseada/${folder}`,
            resource_type: 'image',
            // Reduz o original: fotos de celular chegam com 4000px+ sem
            // necessidade, e o custo de storage/transferência é nosso.
            transformation: [{ width: 2400, crop: 'limit', quality: 'auto' }],
          },
          (error, uploaded) => {
            if (error || !uploaded) {
              reject(error ?? new Error('Upload falhou'));
              return;
            }
            resolve(uploaded);
          },
        )
        .end(file.buffer);
    });

    return {
      url: result.secure_url,
      width: result.width,
      height: result.height,
      blurDataURL: await this.buildBlurDataUrl(result.public_id),
      cloudinaryId: result.public_id,
    };
  }

  // Miniatura de 16px embutida como data URI. É o que o next/image usa como
  // placeholder — sem isso a página sofre layout shift enquanto a foto carrega,
  // justamente o que compromete a meta de LCP.
  private async buildBlurDataUrl(publicId: string): Promise<string> {
    try {
      const tinyUrl = cloudinary.url(publicId, {
        secure: true,
        transformation: [
          { width: 16, crop: 'scale' },
          { quality: 30, fetch_format: 'webp' },
        ],
      });

      const response = await fetch(tinyUrl, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        return '';
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return `data:image/webp;base64,${buffer.toString('base64')}`;
    } catch {
      // Placeholder é melhoria, não requisito: falhar aqui não pode
      // impedir o upload de concluir.
      return '';
    }
  }

  async destroy(cloudinaryId: string | null | undefined): Promise<void> {
    if (!cloudinaryId) {
      return;
    }
    try {
      this.ensureConfigured();
      await cloudinary.uploader.destroy(cloudinaryId);
    } catch {
      // Órfão no Cloudinary é desperdício, não erro de negócio — não pode
      // impedir a remoção do registro.
    }
  }
}
