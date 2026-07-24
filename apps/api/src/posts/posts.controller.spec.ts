// marked and sanitize-html (via htmlparser2) are ESM-only; stub them so Jest
// (CommonJS) can load the import chain. This spec mocks PostsService, so
// markdown rendering / sanitization is never exercised here.
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

import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

describe('PostsController', () => {
  let controller: PostsController;
  const postsService = {
    findPublished: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: postsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PostsController>(PostsController);
  });

  it('returns a paginated list shape { items, nextCursor }', async () => {
    postsService.findPublished.mockResolvedValue({
      items: [{ id: '1' }],
      nextCursor: 'abc',
    });

    const res = await controller.list({ limit: 10 });

    expect(res).toEqual({ items: [{ id: '1' }], nextCursor: 'abc' });
    expect(postsService.findPublished).toHaveBeenCalledWith({ limit: 10 });
  });

  it('fetches a single post by slug', async () => {
    postsService.findBySlug.mockResolvedValue({ slug: 'hello' });

    const res = await controller.getBySlug('hello');

    expect(res).toEqual({ slug: 'hello' });
    expect(postsService.findBySlug).toHaveBeenCalledWith('hello');
  });
});
