import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

const REQUEST_TIMEOUT_MS = 8000;

@Injectable()
export class AiMemoryService {
  async getOverview() {
    const baseUrl = process.env.AI_MEMORY_URL?.trim().replace(/\/+$/, '');
    const token = process.env.AI_MEMORY_AUTH_TOKEN?.trim();

    if (!baseUrl || !token) {
      throw new ServiceUnavailableException(
        'A conexão com ai-memory não está configurada.',
      );
    }

    try {
      const workspaces = await this.getJson<WorkspaceSummary[]>(
        `${baseUrl}/api/v1/workspaces`,
        token,
      );
      const items = await Promise.all(
        workspaces.map(async (workspace) => ({
          ...workspace,
          overview: await this.getJson<WorkspaceOverview>(
            `${baseUrl}/api/v1/workspaces/${encodeURIComponent(workspace.workspace_name)}/overview?limit=5`,
            token,
          ),
        })),
      );

      return { workspaces: items };
    } catch {
      throw new BadGatewayException(
        'Não foi possível obter os dados do ai-memory.',
      );
    }
  }

  private async getJson<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`ai-memory respondeu ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}

export interface WorkspaceSummary {
  workspace_name: string;
  project_count: number;
  page_count: number;
  last_updated: string | null;
}

export interface WorkspaceOverview {
  handoff: {
    agent?: string;
    at?: string;
    project?: string;
    summary?: string;
    open_questions?: string[];
    next_steps?: string[];
  } | null;
  briefing: {
    counts: {
      pages_latest: number;
      pages_all: number;
      sessions: number;
      observations: number;
    };
    activity_7d: {
      sessions: number;
      observations: number;
      pages_updated: number;
    };
    activity_30d: {
      sessions: number;
      observations: number;
      pages_updated: number;
    };
    last_observation_at: string | null;
    pending_handoff_count: number;
    rules: Array<{ path: string; title: string; kind: string; updated_at: string }>;
    recent_pages: Array<{
      path: string;
      title: string;
      kind: string;
      updated_at: string;
    }>;
  };
  health: {
    stale: number;
    duplicates: number;
    contradictions: number;
    orphans: number;
  };
}
