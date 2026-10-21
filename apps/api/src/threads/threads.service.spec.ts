import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ThreadsService } from './threads.service';

const threadHtml = `
  <div id="thread-detail">
    <div>
      <div><h4><a title="Pessoa de Teste">Pessoa de Teste</a></h4><div>@teste</div></div>
      <div class="flex flex-col gap-8">
        <h1><div dir="auto" class="whitespace-pre-wrap text-lg">Uma thread legível</div></h1>
        <div class="h-px border-0 border-transparent"></div>
        <div dir="auto" class="whitespace-pre-wrap text-lg">Continuação</div>
      </div>
    </div>
  </div>`;
const xNoteHtml = `
  <script data-tsr-stream-part>
    metadata:{authorName:"Lucas Leite",screenName:"lucasableite",
      focalTweetId:"2112928258538815887",
      bodyText:"Parágrafo inicial.\\n\\nParágrafo final."}
  </script>`;
const posts = [
  { text: 'Uma thread legível', mediaUrls: [] },
  { text: 'Continuação', mediaUrls: [] },
];
const now = new Date('2026-10-17T12:00:00.000Z');
function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'saved-1', userId: 'admin-a', title: 'Minha leitura',
    sourceUrl: 'https://x.com/teste/status/2112184574721548387',
    authorName: 'Pessoa de Teste', authorHandle: '@teste',
    postsJson: JSON.stringify(posts), createdAt: now, updatedAt: now, ...overrides,
  };
}

function makeService() {
  const prisma = {
    savedThread: {
      create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(),
      updateMany: jest.fn(), deleteMany: jest.fn(),
    },
  };
  return { service: new ThreadsService(prisma as never), prisma };
}

describe('ThreadsService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('imports a public X post by fetching only its normalized thread-reader URL', async () => {
    const { service } = makeService();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(threadHtml, { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    await expect(service.importThread('https://x.com/teste/status/2112184574721548387'))
      .resolves.toMatchObject({ title: 'Uma thread legível', authorHandle: '@teste', posts });
    expect(fetchMock).toHaveBeenCalledWith('https://twitter-thread.com/t/2112184574721548387', expect.objectContaining({ redirect: 'manual' }));
  });

  it('falls back to the public X page for long-form posts missing from the thread reader', async () => {
    const { service } = makeService();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('<h1>Thread Not Found</h1>', { status: 200 }))
      .mockResolvedValueOnce(new Response(xNoteHtml, { status: 200 }));

    await expect(service.importThread('https://x.com/lucasableite/status/2112928258538815887'))
      .resolves.toMatchObject({
        title: 'Parágrafo inicial.\n\nParágrafo final.',
        authorName: 'Lucas Leite',
        authorHandle: '@lucasableite',
        posts: [{ text: 'Parágrafo inicial.\n\nParágrafo final.', mediaUrls: [] }],
      });
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      'https://x.com/lucasableite/status/2112928258538815887',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('does not fetch arbitrary URLs during import', async () => {
    const { service } = makeService();
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(service.importThread('http://127.0.0.1/admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stores newly saved posts under the authenticated admin', async () => {
    const { service, prisma } = makeService();
    prisma.savedThread.create.mockResolvedValue(record());
    await service.createThread('admin-a', {
      title: 'Minha leitura', sourceUrl: 'https://x.com/teste/status/2112184574721548387',
      authorName: 'Pessoa de Teste', authorHandle: '@teste', posts,
    } as never);
    expect(prisma.savedThread.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'admin-a', title: 'Minha leitura', postsJson: JSON.stringify(posts) }),
    });
  });

  it('updates only a saved thread owned by the authenticated admin', async () => {
    const { service, prisma } = makeService();
    prisma.savedThread.updateMany.mockResolvedValue({ count: 1 });
    prisma.savedThread.findFirst.mockResolvedValue(record({ title: 'Título revisado' }));
    await expect(service.updateThread('admin-a', 'saved-1', { title: 'Título revisado' } as never))
      .resolves.toMatchObject({ title: 'Título revisado' });
    expect(prisma.savedThread.updateMany).toHaveBeenCalledWith({
      where: { id: 'saved-1', userId: 'admin-a' }, data: { title: 'Título revisado' },
    });
  });

  it('does not reveal or delete a saved thread owned by another admin', async () => {
    const { service, prisma } = makeService();
    prisma.savedThread.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteThread('admin-a', 'thread-owned-by-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.savedThread.deleteMany).toHaveBeenCalledWith({ where: { id: 'thread-owned-by-b', userId: 'admin-a' } });
  });

  it('cancels the reader stream as soon as it exceeds the HTML byte limit', async () => {
    const { service } = makeService();
    const cancel = jest.fn();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(2 * 1024 * 1024));
        controller.enqueue(new Uint8Array(1));
        setTimeout(() => { if (!cancelled) controller.close(); }, 50);
      },
      cancel() { cancelled = true; cancel(); },
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));

    await expect(service.importThread('https://x.com/teste/status/2112184574721548387'))
      .rejects.toBeInstanceOf(BadGatewayException);
    expect(cancel).toHaveBeenCalled();
  });

  it('returns a gateway error when the external reader is unavailable', async () => {
    const { service } = makeService();
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('Unavailable', { status: 503 }));
    await expect(service.importThread('https://x.com/teste/status/2112184574721548387')).rejects.toBeInstanceOf(BadGatewayException);
  });
});
