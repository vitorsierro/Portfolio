import { readFile } from 'node:fs/promises';
import { ServiceUnavailableException } from '@nestjs/common';
import { CoolifyService } from './coolify.service';

jest.mock('node:fs/promises', () => ({ readFile: jest.fn() }));
const file = jest.mocked(readFile);

describe('CoolifyService', () => {
  afterEach(() => { jest.resetAllMocks(); delete process.env.COOLIFY_PANEL_URL; });

  it('retorna somente campos permitidos, sem configurações ou tokens', async () => {
    file.mockResolvedValue(JSON.stringify({
      collectedAt: new Date().toISOString(), token: 'secret', coolifyAvailable: true,
      updates: { enabled: true, token: 'secret' },
      services: [{ name: 'api', state: 'running', health: 'healthy', environment: { JWT_ACCESS_SECRET: 'secret' } }],
      deployments: [{ commit: 'abc', status: 'finished', logs: 'secret' }],
    }));
    const data = await new CoolifyService().getOverview();
    expect(data.services[0].name).toBe('api');
    expect(data.stale).toBe(false);
    expect(JSON.stringify(data)).not.toContain('secret');
    expect(JSON.stringify(data)).not.toContain('environment');
  });

  it('sinaliza uma coleta antiga em vez de afirmar que a saúde é atual', async () => {
    file.mockResolvedValue(JSON.stringify({ collectedAt: '2020-01-01T00:00:00Z' }));
    expect((await new CoolifyService().getOverview()).stale).toBe(true);
  });

  it('não publica caminho nem conteúdo de um arquivo inválido', async () => {
    file.mockRejectedValue(new Error('/root/private-token'));
    await expect(new CoolifyService().getOverview()).rejects.toThrow(ServiceUnavailableException);
    await expect(new CoolifyService().getOverview()).rejects.not.toThrow('private-token');
  });

  it('recusa URLs com credenciais ou protocolos executáveis', async () => {
    file.mockResolvedValue(JSON.stringify({ collectedAt: new Date().toISOString() }));
    for (const url of ['javascript:alert(1)', 'https://user:secret@example.com', 'http://public.example.com']) {
      process.env.COOLIFY_PANEL_URL = url;
      expect((await new CoolifyService().getOverview()).panelUrl).toBe('http://127.0.0.1:8000/');
    }
  });
});
