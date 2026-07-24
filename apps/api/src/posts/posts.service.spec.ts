// marked and sanitize-html are ESM-only; stub them so Jest can load the module.
jest.mock('marked', () => ({ marked: { parse: (md: string) => md } }));
jest.mock('sanitize-html', () => {
  const fn: (html: string) => string = (html) => html;
  return {
    __esModule: true,
    default: Object.assign(fn, {
      defaults: { allowedTags: [], allowedAttributes: {} },
    }),
  };
});

import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from './posts.service';

describe('PostsService.findPublished (cursor pagination)', () => {
  let service: PostsService;
  const prisma = { post: { findMany: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get<PostsService>(PostsService);
  });

  const row = (id: string) => ({
    id,
    title: `t-${id}`,
    slug: `s-${id}`,
    body: 'body',
    coverImageUrl: null,
    tags: '',
    published: true,
    createdAt: new Date(),
    publishedAt: new Date(),
    updatedAt: new Date(),
  });

  it('points nextCursor at the LAST kept item, not the look-ahead row', async () => {
    // limit 2 → service fetches 3; the 3rd is only look-ahead.
    prisma.post.findMany.mockResolvedValue([row('a'), row('b'), row('c')]);

    const res = await service.findPublished({ limit: 2 });

    expect(res.items.map((i) => i.id)).toEqual(['a', 'b']);
    // Must be 'b' (last returned) so page 2's cursor+skip:1 resumes at 'c'.
    expect(res.nextCursor).toBe('b');
  });

  it('returns nextCursor null on the final page', async () => {
    prisma.post.findMany.mockResolvedValue([row('a'), row('b')]);

    const res = await service.findPublished({ limit: 2 });

    expect(res.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(res.nextCursor).toBeNull();
  });
});
