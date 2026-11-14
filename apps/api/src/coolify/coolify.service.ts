import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';

type Item = Record<string, unknown>;
const object = (value: unknown): Item =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Item : {};
const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 160) : null;
const items = (value: unknown) => Array.isArray(value) ? value.slice(0, 40).map(object) : [];

@Injectable()
export class CoolifyService {
  async getOverview() {
    try {
      const raw = await readFile(process.env.COOLIFY_STATUS_FILE || '/run/portfolio-status/coolify.json', 'utf8');
      if (raw.length > 128 * 1024) throw new Error('Snapshot inválido');
      const data = object(JSON.parse(raw));
      const collectedAt = text(data.collectedAt);
      if (!collectedAt || !Number.isFinite(Date.parse(collectedAt))) throw new Error('Data inválida');
      const updates = object(data.updates);
      return {
        collectedAt,
        stale: Date.now() - Date.parse(collectedAt) > 180_000,
        coolifyAvailable: data.coolifyAvailable === true,
        application: text(data.application),
        status: text(data.status),
        panelUrl: this.panelUrl(),
        updates: {
          enabled: updates.enabled === true,
          result: text(updates.result),
          lastCheck: text(updates.lastCheck),
          nextCheck: text(updates.nextCheck),
          hermesVersion: text(updates.hermesVersion),
          memoryVersion: text(updates.memoryVersion),
        },
        services: items(data.services).map((item) => ({
          name: text(item.name), state: text(item.state), health: text(item.health),
          startedAt: text(item.startedAt), memory: text(item.memory), cpu: text(item.cpu),
          restarts: typeof item.restarts === 'number' ? item.restarts : 0,
        })),
        deployments: items(data.deployments).map((item) => ({
          commit: text(item.commit), status: text(item.status),
          createdAt: text(item.createdAt), finishedAt: text(item.finishedAt),
        })),
      };
    } catch {
      throw new ServiceUnavailableException('O monitor do Coolify está temporariamente indisponível.');
    }
  }

  private panelUrl() {
    try {
      const url = new URL(process.env.COOLIFY_PANEL_URL || 'http://127.0.0.1:8000');
      const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
      if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('URL inválida');
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return 'http://127.0.0.1:8000/';
    }
  }
}
