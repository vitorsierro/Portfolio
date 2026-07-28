import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EnseadaService } from './enseada.service';

describe('EnseadaService.getContent', () => {
  let service: EnseadaService;
  const prisma = {
    property: { findUnique: jest.fn() },
    space: { findMany: jest.fn() },
    amenity: { findMany: jest.fn() },
    restaurant: { findMany: jest.fn() },
    activity: { findMany: jest.fn() },
    faqItem: { findMany: jest.fn() },
    model3d: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.values(prisma).forEach((delegate) => {
      if ('findMany' in delegate) delegate.findMany.mockResolvedValue([]);
      if ('findUnique' in delegate) delegate.findUnique.mockResolvedValue(null);
    });

    const module = await Test.createTestingModule({
      providers: [EnseadaService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<EnseadaService>(EnseadaService);
  });

  it('devolve o contrato completo mesmo com o banco vazio', async () => {
    // O site consome este JSON em build time; faltar uma chave quebraria a
    // validação Zod do outro lado e derrubaria o build.
    const content = await service.getContent();

    expect(Object.keys(content).sort()).toEqual([
      'amenities',
      'faq',
      'guide',
      'model3d',
      'property',
      'seo',
      'spaces',
      'updatedAt',
    ]);
    expect(content.guide).toEqual({ restaurants: [], activities: [] });
    expect(content.property.minNights).toBe(1);
  });

  it('converte campos CSV de volta para array', async () => {
    prisma.space.findMany.mockResolvedValue([
      {
        slug: 'quarto',
        category: 'quarto',
        title: 'Quarto',
        description: '',
        order: 0,
        amenities: 'ar-condicionado,cama-queen',
        images: [],
      },
    ]);
    prisma.activity.findMany.mockResolvedValue([
      {
        slug: 'trilha',
        name: 'Trilha',
        category: 'trilha',
        seasons: 'verao,inverno',
        distanceMinutes: 10,
        description: '',
        tip: '',
        lat: null,
        lng: null,
        imageUrl: '',
        imageAlt: '',
        imageWidth: null,
        imageHeight: null,
        imageBlur: '',
      },
    ]);

    const content = await service.getContent();

    expect(content.spaces[0].amenities).toEqual(['ar-condicionado', 'cama-queen']);
    expect(content.guide.activities[0].season).toEqual(['verao', 'inverno']);
  });

  it('trata CSV vazio como lista vazia, não [""]', async () => {
    prisma.space.findMany.mockResolvedValue([
      {
        slug: 's',
        category: 'sala',
        title: 'Sala',
        description: '',
        order: 0,
        amenities: '',
        images: [],
      },
    ]);

    const content = await service.getContent();

    expect(content.spaces[0].amenities).toEqual([]);
  });

  it('notifySite não lança quando o site está fora do ar', async () => {
    process.env.ENSEADA_REVALIDATE_URL = 'http://localhost:9/nao-existe';
    process.env.ENSEADA_REVALIDATE_SECRET = 'x';

    // Salvar conteúdo não pode falhar porque o site não respondeu.
    await expect(service.notifySite()).resolves.toBeUndefined();

    delete process.env.ENSEADA_REVALIDATE_URL;
    delete process.env.ENSEADA_REVALIDATE_SECRET;
  });
});
