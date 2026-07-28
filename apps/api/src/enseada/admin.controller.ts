import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivityDto,
  AmenityDto,
  FaqItemDto,
  Model3dDto,
  PropertyDto,
  ReorderDto,
  RestaurantDto,
  SpaceDto,
} from './dto/enseada.dto';
import { EnseadaService } from './enseada.service';
import { UploadService } from './upload/upload.service';

const SINGLETON = 'singleton';

@Controller('admin/enseada')
@UseGuards(JwtAuthGuard)
export class EnseadaAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enseada: EnseadaService,
    private readonly uploads: UploadService,
  ) {}

  // Espelha exatamente o que a API pública devolve — a tela de preview usa
  // isto para que não haja dúvida sobre o que o site vai receber.
  @Get('preview')
  preview() {
    return this.enseada.getContent();
  }

  // --- Property (registro único) -------------------------------------------

  @Get('property')
  async getProperty() {
    return (
      (await this.prisma.property.findUnique({ where: { id: SINGLETON } })) ?? {
        id: SINGLETON,
      }
    );
  }

  @Put('property')
  async saveProperty(@Body() dto: PropertyDto) {
    const saved = await this.prisma.property.upsert({
      where: { id: SINGLETON },
      create: { id: SINGLETON, ...dto },
      update: dto,
    });
    await this.enseada.notifySite();
    return saved;
  }

  // --- Spaces ---------------------------------------------------------------

  @Get('spaces')
  listSpaces() {
    return this.prisma.space.findMany({
      orderBy: { order: 'asc' },
      include: { images: { orderBy: { order: 'asc' } } },
    });
  }

  @Post('spaces')
  async createSpace(@Body() dto: SpaceDto) {
    this.assertHasImages(dto);
    await this.assertSlugFree('space', dto.slug);

    const created = await this.prisma.space.create({
      data: {
        slug: dto.slug,
        category: dto.category,
        title: dto.title,
        description: dto.description ?? '',
        order: dto.order ?? 0,
        amenities: (dto.amenities ?? []).join(','),
        images: { create: this.imageRows(dto) },
      },
      include: { images: true },
    });
    await this.enseada.notifySite();
    return created;
  }

  @Put('spaces/:id')
  async updateSpace(@Param('id') id: string, @Body() dto: SpaceDto) {
    this.assertHasImages(dto);
    const existing = await this.prisma.space.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Ambiente não encontrado');
    }
    if (dto.slug !== existing.slug) {
      await this.assertSlugFree('space', dto.slug);
    }

    // Substitui a galeria inteira: o front sempre manda a lista completa na
    // ordem final, então reconciliar item a item só adicionaria complexidade.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.spaceImage.deleteMany({ where: { spaceId: id } });
      return tx.space.update({
        where: { id },
        data: {
          slug: dto.slug,
          category: dto.category,
          title: dto.title,
          description: dto.description ?? '',
          order: dto.order ?? existing.order,
          amenities: (dto.amenities ?? []).join(','),
          images: { create: this.imageRows(dto) },
        },
        include: { images: true },
      });
    });
    await this.enseada.notifySite();
    return updated;
  }

  @Delete('spaces/:id')
  async removeSpace(@Param('id') id: string) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!space) {
      throw new NotFoundException('Ambiente não encontrado');
    }
    await this.prisma.space.delete({ where: { id } });
    // Limpa o Cloudinary só depois que o banco confirmou.
    await Promise.all(space.images.map((i) => this.uploads.destroy(i.cloudinaryId)));
    await this.enseada.notifySite();
    return { success: true as const };
  }

  @Post('spaces/reorder')
  async reorderSpaces(@Body() dto: ReorderDto) {
    await this.applyOrder('space', dto.ids);
    await this.enseada.notifySite();
    return { success: true as const };
  }

  // --- Amenities ------------------------------------------------------------

  @Get('amenities')
  listAmenities() {
    return this.prisma.amenity.findMany({
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
  }

  @Post('amenities')
  async createAmenity(@Body() dto: AmenityDto) {
    await this.assertSlugFree('amenity', dto.slug);
    const created = await this.prisma.amenity.create({ data: dto });
    await this.enseada.notifySite();
    return created;
  }

  @Put('amenities/:id')
  async updateAmenity(@Param('id') id: string, @Body() dto: AmenityDto) {
    const updated = await this.prisma.amenity.update({ where: { id }, data: dto });
    await this.enseada.notifySite();
    return updated;
  }

  @Delete('amenities/:id')
  async removeAmenity(@Param('id') id: string) {
    await this.prisma.amenity.delete({ where: { id } });
    await this.enseada.notifySite();
    return { success: true as const };
  }

  // --- Guia: restaurantes ---------------------------------------------------

  @Get('restaurants')
  listRestaurants() {
    return this.prisma.restaurant.findMany({ orderBy: { order: 'asc' } });
  }

  @Post('restaurants')
  async createRestaurant(@Body() dto: RestaurantDto) {
    await this.assertSlugFree('restaurant', dto.slug);
    const created = await this.prisma.restaurant.create({ data: dto });
    await this.enseada.notifySite();
    return created;
  }

  @Put('restaurants/:id')
  async updateRestaurant(@Param('id') id: string, @Body() dto: RestaurantDto) {
    const updated = await this.prisma.restaurant.update({ where: { id }, data: dto });
    await this.enseada.notifySite();
    return updated;
  }

  @Delete('restaurants/:id')
  async removeRestaurant(@Param('id') id: string) {
    const row = await this.prisma.restaurant.findUnique({ where: { id } });
    await this.prisma.restaurant.delete({ where: { id } });
    await this.uploads.destroy(row?.cloudinaryId);
    await this.enseada.notifySite();
    return { success: true as const };
  }

  // --- Guia: atividades -----------------------------------------------------

  @Get('activities')
  listActivities() {
    return this.prisma.activity.findMany({ orderBy: { order: 'asc' } });
  }

  @Post('activities')
  async createActivity(@Body() dto: ActivityDto) {
    await this.assertSlugFree('activity', dto.slug);
    const { seasons, ...rest } = dto;
    const created = await this.prisma.activity.create({
      data: { ...rest, seasons: (seasons ?? []).join(',') },
    });
    await this.enseada.notifySite();
    return created;
  }

  @Put('activities/:id')
  async updateActivity(@Param('id') id: string, @Body() dto: ActivityDto) {
    const { seasons, ...rest } = dto;
    const updated = await this.prisma.activity.update({
      where: { id },
      data: { ...rest, seasons: (seasons ?? []).join(',') },
    });
    await this.enseada.notifySite();
    return updated;
  }

  @Delete('activities/:id')
  async removeActivity(@Param('id') id: string) {
    const row = await this.prisma.activity.findUnique({ where: { id } });
    await this.prisma.activity.delete({ where: { id } });
    await this.uploads.destroy(row?.cloudinaryId);
    await this.enseada.notifySite();
    return { success: true as const };
  }

  // --- FAQ ------------------------------------------------------------------

  @Get('faq')
  listFaq() {
    return this.prisma.faqItem.findMany({ orderBy: { order: 'asc' } });
  }

  @Post('faq')
  async createFaq(@Body() dto: FaqItemDto) {
    const created = await this.prisma.faqItem.create({ data: dto });
    await this.enseada.notifySite();
    return created;
  }

  @Put('faq/:id')
  async updateFaq(@Param('id') id: string, @Body() dto: FaqItemDto) {
    const updated = await this.prisma.faqItem.update({ where: { id }, data: dto });
    await this.enseada.notifySite();
    return updated;
  }

  @Delete('faq/:id')
  async removeFaq(@Param('id') id: string) {
    await this.prisma.faqItem.delete({ where: { id } });
    await this.enseada.notifySite();
    return { success: true as const };
  }

  @Post('faq/reorder')
  async reorderFaq(@Body() dto: ReorderDto) {
    await this.applyOrder('faqItem', dto.ids);
    await this.enseada.notifySite();
    return { success: true as const };
  }

  // --- Modelo 3D ------------------------------------------------------------

  @Get('model3d')
  async getModel3d() {
    return (
      (await this.prisma.model3d.findUnique({ where: { id: SINGLETON } })) ?? {
        id: SINGLETON,
        enabled: false,
        type: 'gltf',
        url: '',
        posterUrl: '',
      }
    );
  }

  @Put('model3d')
  async saveModel3d(@Body() dto: Model3dDto) {
    const saved = await this.prisma.model3d.upsert({
      where: { id: SINGLETON },
      create: { id: SINGLETON, ...dto },
      update: dto,
    });
    await this.enseada.notifySite();
    return saved;
  }

  // --- helpers --------------------------------------------------------------

  // Um ambiente sem foto não tem o que mostrar no site — barrar aqui evita
  // publicar uma seção vazia.
  private assertHasImages(dto: SpaceDto): void {
    if (!dto.images?.length) {
      throw new BadRequestException('Adicione ao menos uma imagem ao ambiente');
    }
  }

  private imageRows(dto: SpaceDto) {
    return (dto.images ?? []).map((image, index) => ({
      url: image.url,
      alt: image.alt ?? '',
      width: image.width,
      height: image.height,
      blurDataURL: image.blurDataURL ?? '',
      cloudinaryId: image.cloudinaryId ?? null,
      order: index,
    }));
  }

  // switch em vez de indexar this.prisma[model]: os delegates do Prisma têm
  // tipos distintos, e o cast genérico que unificaria isso descarta justamente
  // a checagem que torna essas chamadas seguras.
  private async assertSlugFree(
    model: 'space' | 'amenity' | 'restaurant' | 'activity',
    slug: string,
  ): Promise<void> {
    const where = { slug };
    const found =
      model === 'space'
        ? await this.prisma.space.findUnique({ where })
        : model === 'amenity'
          ? await this.prisma.amenity.findUnique({ where })
          : model === 'restaurant'
            ? await this.prisma.restaurant.findUnique({ where })
            : await this.prisma.activity.findUnique({ where });

    if (found) {
      throw new BadRequestException(`Já existe um registro com o slug "${slug}"`);
    }
  }

  private async applyOrder(
    model: 'space' | 'faqItem',
    ids: string[],
  ): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        model === 'space'
          ? this.prisma.space.update({ where: { id }, data: { order: index } })
          : this.prisma.faqItem.update({ where: { id }, data: { order: index } }),
      ),
    );
  }
}
