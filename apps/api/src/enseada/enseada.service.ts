import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Monta o JSON consolidado que o site-enseada consome. Este formato é o
// contrato entre os dois projetos — mudanças aqui quebram o site, então
// mantenha em sincronia com os tipos Zod de lá.
@Injectable()
export class EnseadaService {
  private readonly logger = new Logger(EnseadaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getContent() {
    const [property, spaces, amenities, restaurants, activities, faq, model3d] =
      await Promise.all([
        this.prisma.property.findUnique({ where: { id: 'singleton' } }),
        this.prisma.space.findMany({
          orderBy: { order: 'asc' },
          include: { images: { orderBy: { order: 'asc' } } },
        }),
        this.prisma.amenity.findMany({ orderBy: [{ group: 'asc' }, { order: 'asc' }] }),
        this.prisma.restaurant.findMany({
          where: { published: true },
          orderBy: { order: 'asc' },
        }),
        this.prisma.activity.findMany({
          where: { published: true },
          orderBy: { order: 'asc' },
        }),
        this.prisma.faqItem.findMany({ orderBy: { order: 'asc' } }),
        this.prisma.model3d.findUnique({ where: { id: 'singleton' } }),
      ]);

    return {
      property: {
        name: property?.name ?? '',
        tagline: property?.tagline ?? '',
        description: property?.description ?? '',
        airbnbListingId: property?.airbnbListingId ?? '',
        maxGuests: property?.maxGuests ?? 0,
        bedrooms: property?.bedrooms ?? 0,
        beds: property?.beds ?? 0,
        bathrooms: property?.bathrooms ?? 0,
        areaM2: property?.areaM2 ?? 0,
        basePriceFrom: property?.basePriceFrom ?? 0,
        minNights: property?.minNights ?? 1,
        checkInTime: property?.checkInTime ?? '15:00',
        checkOutTime: property?.checkOutTime ?? '11:00',
        coordinates: { lat: property?.lat ?? 0, lng: property?.lng ?? 0 },
        neighborhood: property?.neighborhood ?? '',
      },
      spaces: spaces.map((space) => ({
        slug: space.slug,
        category: space.category,
        title: space.title,
        description: space.description,
        order: space.order,
        amenities: this.csv(space.amenities),
        images: space.images.map((image) => ({
          url: image.url,
          alt: image.alt,
          width: image.width,
          height: image.height,
          blurDataURL: image.blurDataURL,
        })),
      })),
      amenities: amenities.map((a) => ({
        slug: a.slug,
        label: a.label,
        icon: a.icon,
        group: a.group,
      })),
      model3d: {
        enabled: model3d?.enabled ?? false,
        type: model3d?.type ?? 'gltf',
        url: model3d?.url ?? '',
        posterUrl: model3d?.posterUrl ?? '',
      },
      guide: {
        restaurants: restaurants.map((r) => ({
          slug: r.slug,
          name: r.name,
          cuisine: r.cuisine,
          priceRange: r.priceRange,
          distanceMinutes: r.distanceMinutes,
          distanceMode: r.distanceMode,
          description: r.description,
          tip: r.tip,
          coordinates: { lat: r.lat ?? 0, lng: r.lng ?? 0 },
          mapsUrl: r.mapsUrl,
          image: this.image(r),
        })),
        activities: activities.map((a) => ({
          slug: a.slug,
          name: a.name,
          category: a.category,
          season: this.csv(a.seasons),
          distanceMinutes: a.distanceMinutes,
          description: a.description,
          tip: a.tip,
          coordinates: { lat: a.lat ?? 0, lng: a.lng ?? 0 },
          image: this.image(a),
        })),
      },
      faq: faq.map((f) => ({ question: f.question, answer: f.answer })),
      seo: {
        title: property?.seoTitle ?? '',
        description: property?.seoDescription ?? '',
        ogImage: property?.seoOgImage ?? '',
      },
      updatedAt: (property?.updatedAt ?? new Date()).toISOString(),
    };
  }

  // Avisa o site para revalidar. Falha aqui NÃO pode bloquear o salvamento —
  // o conteúdo já está persistido, e o site revalida sozinho pelo ISR.
  async notifySite(): Promise<void> {
    const url = process.env.ENSEADA_REVALIDATE_URL;
    const secret = process.env.ENSEADA_REVALIDATE_SECRET;
    if (!url || !secret) {
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'x-revalidate-secret': secret },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        this.logger.warn(`Revalidação respondeu ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `Não foi possível avisar o site: ${(error as Error).message}`,
      );
    }
  }

  private csv(value: string): string[] {
    return value
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
  }

  private image(row: {
    imageUrl: string;
    imageAlt: string;
    imageWidth: number | null;
    imageHeight: number | null;
    imageBlur: string;
  }) {
    return {
      url: row.imageUrl,
      alt: row.imageAlt,
      width: row.imageWidth ?? 0,
      height: row.imageHeight ?? 0,
      blurDataURL: row.imageBlur,
    };
  }
}
