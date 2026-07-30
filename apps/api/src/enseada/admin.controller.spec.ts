import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { EnseadaAdminController } from './admin.controller';
import { EnseadaService } from './enseada.service';
import { UploadService } from './upload/upload.service';

function delegate() {
  return {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
}

describe('EnseadaAdminController', () => {
  let controller: EnseadaAdminController;

  const prisma = {
    property: delegate(),
    space: delegate(),
    spaceImage: delegate(),
    amenity: delegate(),
    restaurant: delegate(),
    activity: delegate(),
    faqItem: delegate(),
    model3d: delegate(),
    // Cobre tanto o uso em array (listAll-style) quanto o uso com callback
    // (updateSpace) — os dois estilos aparecem no controller.
    $transaction: jest.fn((arg: any): any =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    ),
  };

  const enseada = { getContent: jest.fn(), notifySite: jest.fn() };
  const uploads = { destroy: jest.fn(), upload: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    enseada.notifySite.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnseadaAdminController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: EnseadaService, useValue: enseada },
        { provide: UploadService, useValue: uploads },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EnseadaAdminController>(EnseadaAdminController);
  });

  it('preview() espelha o que a API publica devolveria', async () => {
    enseada.getContent.mockResolvedValue({ property: {} });
    await expect(controller.preview()).resolves.toEqual({ property: {} });
  });

  describe('property (singleton)', () => {
    it('devolve o registro existente', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'singleton', name: 'Casa' });
      await expect(controller.getProperty()).resolves.toEqual({
        id: 'singleton',
        name: 'Casa',
      });
    });

    it('cai no fallback { id: singleton } quando ainda nao existe', async () => {
      prisma.property.findUnique.mockResolvedValue(null);
      await expect(controller.getProperty()).resolves.toEqual({ id: 'singleton' });
    });

    it('saveProperty faz upsert e avisa o site', async () => {
      const dto = { name: 'Casa Nova' } as any;
      prisma.property.upsert.mockResolvedValue({ id: 'singleton', ...dto });

      const result = await controller.saveProperty(dto);

      expect(prisma.property.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...dto },
        update: dto,
      });
      expect(result).toEqual({ id: 'singleton', ...dto });
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });
  });

  describe('spaces', () => {
    const dto = (overrides = {}) => ({
      slug: 'quarto-casal',
      category: 'quarto',
      title: 'Quarto de casal',
      images: [{ url: 'https://img/1.jpg', width: 800, height: 600 }],
      ...overrides,
    }) as any;

    it('createSpace recusa um ambiente sem nenhuma imagem', async () => {
      await expect(controller.createSpace(dto({ images: [] }))).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.space.create).not.toHaveBeenCalled();
    });

    it('createSpace recusa slug ja em uso', async () => {
      prisma.space.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(controller.createSpace(dto())).rejects.toThrow(
        'Já existe um registro com o slug "quarto-casal"',
      );
      expect(prisma.space.create).not.toHaveBeenCalled();
    });

    it('createSpace persiste as imagens na ordem recebida e avisa o site', async () => {
      prisma.space.findUnique.mockResolvedValue(null);
      prisma.space.create.mockResolvedValue({ id: 's1' });

      await controller.createSpace(
        dto({
          amenities: ['wifi', 'ar-condicionado'],
          images: [
            { url: 'a.jpg', width: 1, height: 1 },
            { url: 'b.jpg', width: 1, height: 1 },
          ],
        }),
      );

      expect(prisma.space.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'quarto-casal',
          amenities: 'wifi,ar-condicionado',
          images: {
            create: [
              expect.objectContaining({ url: 'a.jpg', order: 0 }),
              expect.objectContaining({ url: 'b.jpg', order: 1 }),
            ],
          },
        }),
        include: { images: true },
      });
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });

    it('updateSpace valida imagens antes mesmo de checar se o id existe', async () => {
      await expect(
        controller.updateSpace('s1', dto({ images: [] })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.space.findUnique).not.toHaveBeenCalled();
    });

    it('updateSpace lanca NotFoundException para id inexistente', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(controller.updateSpace('s1', dto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updateSpace recusa trocar para um slug ja usado por outro registro', async () => {
      prisma.space.findUnique
        .mockResolvedValueOnce({ id: 's1', slug: 'antigo-slug' }) // existing
        .mockResolvedValueOnce({ id: 's2' }); // clash

      await expect(
        controller.updateSpace('s1', dto({ slug: 'quarto-casal' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateSpace substitui a galeria inteira dentro de uma transacao', async () => {
      prisma.space.findUnique.mockResolvedValue({ id: 's1', slug: 'quarto-casal', order: 0 });
      prisma.spaceImage.deleteMany.mockResolvedValue({ count: 2 });
      prisma.space.update.mockResolvedValue({ id: 's1' });

      await controller.updateSpace('s1', dto());

      expect(prisma.spaceImage.deleteMany).toHaveBeenCalledWith({
        where: { spaceId: 's1' },
      });
      expect(prisma.space.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's1' } }),
      );
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });

    it('removeSpace lanca NotFoundException quando o ambiente nao existe', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(controller.removeSpace('s1')).rejects.toThrow(NotFoundException);
      expect(prisma.space.delete).not.toHaveBeenCalled();
    });

    it('removeSpace apaga do banco primeiro e so entao limpa o Cloudinary', async () => {
      const callOrder: string[] = [];
      prisma.space.findUnique.mockResolvedValue({
        id: 's1',
        images: [{ cloudinaryId: 'img-1' }, { cloudinaryId: 'img-2' }],
      });
      prisma.space.delete.mockImplementation(async () => {
        callOrder.push('db-delete');
        return { id: 's1' };
      });
      uploads.destroy.mockImplementation(async (id: string) => {
        callOrder.push(`cloudinary-destroy:${id}`);
      });

      await controller.removeSpace('s1');

      expect(callOrder).toEqual([
        'db-delete',
        'cloudinary-destroy:img-1',
        'cloudinary-destroy:img-2',
      ]);
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });

    it('reorderSpaces aplica a nova ordem em uma unica transacao', async () => {
      prisma.space.update.mockResolvedValue({});

      await controller.reorderSpaces({ ids: ['c', 'a', 'b'] });

      expect(prisma.$transaction).toHaveBeenCalledWith([
        expect.anything(),
        expect.anything(),
        expect.anything(),
      ]);
      expect(prisma.space.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'c' },
        data: { order: 0 },
      });
      expect(prisma.space.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'a' },
        data: { order: 1 },
      });
      expect(prisma.space.update).toHaveBeenNthCalledWith(3, {
        where: { id: 'b' },
        data: { order: 2 },
      });
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });
  });

  describe('amenities', () => {
    it('createAmenity recusa slug duplicado', async () => {
      prisma.amenity.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        controller.createAmenity({ slug: 'wifi', label: 'Wi-Fi' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('createAmenity cria e avisa o site', async () => {
      prisma.amenity.findUnique.mockResolvedValue(null);
      prisma.amenity.create.mockResolvedValue({ id: 'a1', slug: 'wifi' });

      const result = await controller.createAmenity({
        slug: 'wifi',
        label: 'Wi-Fi',
      } as any);

      expect(result).toEqual({ id: 'a1', slug: 'wifi' });
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });

    it('removeAmenity apaga e avisa o site', async () => {
      prisma.amenity.delete.mockResolvedValue({ id: 'a1' });

      await controller.removeAmenity('a1');

      expect(prisma.amenity.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });
  });

  describe('restaurants', () => {
    it('createRestaurant recusa slug duplicado', async () => {
      prisma.restaurant.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        controller.createRestaurant({ slug: 'boteco', name: 'Boteco' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('removeRestaurant limpa a imagem no Cloudinary depois de excluir', async () => {
      prisma.restaurant.findUnique.mockResolvedValue({
        id: 'r1',
        cloudinaryId: 'enseada/restaurantes/foto',
      });
      prisma.restaurant.delete.mockResolvedValue({ id: 'r1' });

      await controller.removeRestaurant('r1');

      expect(uploads.destroy).toHaveBeenCalledWith('enseada/restaurantes/foto');
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });
  });

  describe('activities', () => {
    it('createActivity converte o array de seasons para CSV', async () => {
      prisma.activity.findUnique.mockResolvedValue(null);
      prisma.activity.create.mockResolvedValue({ id: 'act1' });

      await controller.createActivity({
        slug: 'trilha',
        name: 'Trilha',
        seasons: ['verao', 'inverno'],
      } as any);

      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ seasons: 'verao,inverno' }),
      });
    });

    it('updateActivity converte seasons ausente para CSV vazio', async () => {
      prisma.activity.update.mockResolvedValue({ id: 'act1' });

      await controller.updateActivity('act1', {
        slug: 'trilha',
        name: 'Trilha',
      } as any);

      expect(prisma.activity.update).toHaveBeenCalledWith({
        where: { id: 'act1' },
        data: expect.objectContaining({ seasons: '' }),
      });
    });
  });

  describe('faq', () => {
    it('reorderFaq usa faqItem.update dentro da transacao', async () => {
      prisma.faqItem.update.mockResolvedValue({});

      await controller.reorderFaq({ ids: ['q2', 'q1'] });

      expect(prisma.faqItem.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'q2' },
        data: { order: 0 },
      });
      expect(prisma.faqItem.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'q1' },
        data: { order: 1 },
      });
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });
  });

  describe('model3d (singleton)', () => {
    it('getModel3d cai no fallback desabilitado quando nao configurado', async () => {
      prisma.model3d.findUnique.mockResolvedValue(null);

      await expect(controller.getModel3d()).resolves.toEqual({
        id: 'singleton',
        enabled: false,
        type: 'gltf',
        url: '',
        posterUrl: '',
      });
    });

    it('saveModel3d faz upsert e avisa o site', async () => {
      const dto = { enabled: true, type: 'gltf', url: 'x.glb' } as any;
      prisma.model3d.upsert.mockResolvedValue({ id: 'singleton', ...dto });

      await controller.saveModel3d(dto);

      expect(prisma.model3d.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...dto },
        update: dto,
      });
      expect(enseada.notifySite).toHaveBeenCalledTimes(1);
    });
  });
});
