// marked/sanitize-html sao ESM-only; PostsService importa a cadeia deles, e o
// Jest roda em CommonJS. Este spec mocka PostsService por inteiro, mas o
// import do modulo real ainda acontece — precisa do stub (ver posts.controller.spec.ts).
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
import { AdminPostsController } from './admin-posts.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostsService } from './posts.service';

describe('AdminPostsController', () => {
  let controller: AdminPostsController;
  const postsService = {
    listAll: jest.fn(),
    getById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPostsController],
      providers: [{ provide: PostsService, useValue: postsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminPostsController>(AdminPostsController);
  });

  it('repassa a query para listAll e devolve o resultado paginado', async () => {
    const result = {
      items: [{ id: '1', title: 'A', published: false }],
      total: 1,
      page: 1,
      limit: 20,
      pageCount: 1,
    };
    postsService.listAll.mockResolvedValue(result);

    const res = await controller.list({ q: 'a', page: 1, limit: 20 });

    expect(res).toEqual(result);
    expect(postsService.listAll).toHaveBeenCalledWith({
      q: 'a',
      page: 1,
      limit: 20,
    });
  });

  it('busca um post pelo id, incluindo o corpo em markdown', async () => {
    const post = { id: '1', title: 'A', body: '# markdown' };
    postsService.getById.mockResolvedValue(post);

    const res = await controller.getById('1');

    expect(res).toEqual(post);
    expect(postsService.getById).toHaveBeenCalledWith('1');
  });

  it('propaga o NotFoundException do service quando o id nao existe', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    postsService.getById.mockRejectedValue(new NotFoundException('Post not found'));

    await expect(controller.getById('inexistente')).rejects.toThrow(
      'Post not found',
    );
  });
});
