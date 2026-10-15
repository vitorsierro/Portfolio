import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { AiMemoryService } from './ai-memory.service';

describe('AiMemoryService', () => {
  const originalUrl = process.env.AI_MEMORY_URL;
  const originalToken = process.env.AI_MEMORY_AUTH_TOKEN;
  let service: AiMemoryService;

  beforeEach(() => {
    service = new AiMemoryService();
    process.env.AI_MEMORY_URL = 'http://ai-memory:49374/';
    process.env.AI_MEMORY_AUTH_TOKEN = 'server-only-token';
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.AI_MEMORY_URL;
    else process.env.AI_MEMORY_URL = originalUrl;
    if (originalToken === undefined) delete process.env.AI_MEMORY_AUTH_TOKEN;
    else process.env.AI_MEMORY_AUTH_TOKEN = originalToken;
    jest.restoreAllMocks();
  });

  it('busca os workspaces e seus respectivos overviews usando Bearer no servidor', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          workspace_name: 'default',
          project_count: 1,
          page_count: 12,
          last_updated: null,
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        handoff: null,
        briefing: { counts: { pages_latest: 12 } },
        health: { stale: 0, duplicates: 0, contradictions: 0, orphans: 0 },
      }), { status: 200 }));

    const result = await service.getOverview();

    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0].overview.briefing.counts.pages_latest).toBe(12);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://ai-memory:49374/api/v1/workspaces',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer server-only-token',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://ai-memory:49374/api/v1/workspaces/default/overview?limit=5',
      expect.any(Object),
    );
  });

  it('exige URL e token configurados', async () => {
    delete process.env.AI_MEMORY_AUTH_TOKEN;

    await expect(service.getOverview()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('não expõe erros recebidos do serviço externo', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('detalhes internos', { status: 401 }),
    );

    await expect(service.getOverview()).rejects.toEqual(
      new BadGatewayException('Não foi possível obter os dados do ai-memory.'),
    );
  });
});
