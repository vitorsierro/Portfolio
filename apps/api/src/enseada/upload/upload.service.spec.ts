const uploadStreamMock = jest.fn();
const destroyMock = jest.fn();
const urlMock = jest.fn();
const configMock = jest.fn();

jest.mock('cloudinary', () => ({
  v2: {
    config: (...args: unknown[]) => configMock(...args),
    uploader: {
      upload_stream: (...args: unknown[]) => uploadStreamMock(...args),
      destroy: (...args: unknown[]) => destroyMock(...args),
    },
    url: (...args: unknown[]) => urlMock(...args),
  },
}));

import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { UploadService } from './upload.service';

function fakeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    buffer: Buffer.from('fake-image-bytes'),
    mimetype: 'image/png',
    size: 1024,
    fieldname: 'file',
    originalname: 'photo.png',
    encoding: '7bit',
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  } as Express.Multer.File;
}

const CLOUDINARY_ENV = {
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
};

describe('UploadService', () => {
  let service: UploadService;
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    service = new UploadService();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('validacao antes de tocar o Cloudinary', () => {
    it('rejeita quando nenhum arquivo foi enviado', async () => {
      await expect(
        service.upload(undefined as unknown as Express.Multer.File, 'geral'),
      ).rejects.toThrow(BadRequestException);
      expect(uploadStreamMock).not.toHaveBeenCalled();
    });

    it('rejeita mimetype fora da allowlist', async () => {
      await expect(
        service.upload(fakeFile({ mimetype: 'application/pdf' }), 'geral'),
      ).rejects.toThrow('Formato não suportado');
      expect(uploadStreamMock).not.toHaveBeenCalled();
    });

    it('rejeita arquivo acima de 10MB', async () => {
      await expect(
        service.upload(fakeFile({ size: 10 * 1024 * 1024 + 1 }), 'geral'),
      ).rejects.toThrow('Imagem acima de 10MB');
      expect(uploadStreamMock).not.toHaveBeenCalled();
    });

    it('lanca InternalServerErrorException quando o Cloudinary nao esta configurado', async () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      await expect(service.upload(fakeFile(), 'geral')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('upload com sucesso', () => {
    beforeEach(() => {
      Object.assign(process.env, CLOUDINARY_ENV);
      uploadStreamMock.mockImplementation((_options, callback) => {
        callback(null, {
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/enseada/geral/abc.png',
          width: 800,
          height: 600,
          public_id: 'enseada/geral/abc',
        });
        return { end: jest.fn() };
      });
      urlMock.mockReturnValue('https://res.cloudinary.com/demo/image/tiny.webp');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('tiny').buffer,
      }) as unknown as typeof fetch;
    });

    it('configura o Cloudinary uma unica vez e devolve os metadados da imagem', async () => {
      const result = await service.upload(fakeFile(), 'geral');

      expect(configMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        url: 'https://res.cloudinary.com/demo/image/upload/v1/enseada/geral/abc.png',
        width: 800,
        height: 600,
        blurDataURL: expect.stringMatching(/^data:image\/webp;base64,/),
        cloudinaryId: 'enseada/geral/abc',
      });

      // Segunda chamada nao deve reconfigurar.
      await service.upload(fakeFile(), 'geral');
      expect(configMock).toHaveBeenCalledTimes(1);
    });

    it('sobe para a pasta enseada/<folder> pedida', async () => {
      await service.upload(fakeFile(), 'restaurantes');

      expect(uploadStreamMock).toHaveBeenCalledWith(
        expect.objectContaining({ folder: 'enseada/restaurantes' }),
        expect.any(Function),
      );
    });

    it('devolve blurDataURL vazio quando a miniatura falha, sem quebrar o upload', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));

      const result = await service.upload(fakeFile(), 'geral');

      expect(result.blurDataURL).toBe('');
      expect(result.url).toContain('abc.png');
    });

    it('rejeita quando o Cloudinary devolve erro no upload_stream', async () => {
      uploadStreamMock.mockImplementation((_options, callback) => {
        callback(new Error('cloudinary indisponivel'), null);
        return { end: jest.fn() };
      });

      await expect(service.upload(fakeFile(), 'geral')).rejects.toThrow(
        'cloudinary indisponivel',
      );
    });
  });

  describe('destroy', () => {
    it('nao chama o Cloudinary quando nao ha cloudinaryId', async () => {
      await service.destroy(null);
      await service.destroy(undefined);

      expect(destroyMock).not.toHaveBeenCalled();
    });

    it('engole erros do Cloudinary: o registro no banco ja foi removido', async () => {
      Object.assign(process.env, CLOUDINARY_ENV);
      destroyMock.mockRejectedValue(new Error('nao encontrado'));

      await expect(service.destroy('enseada/geral/abc')).resolves.toBeUndefined();
      expect(destroyMock).toHaveBeenCalledWith('enseada/geral/abc');
    });
  });
});
