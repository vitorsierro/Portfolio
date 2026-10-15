'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, ensureSession } from '../../../lib/auth';
import { ROUTER_LOGIN } from '../../../constants';
import styles from '../../../styles/Admin.module.css';

function formatDate(value) {
  if (!value) return 'Ainda sem atividade';
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function Metric({ label, value }) {
  return (
    <div className={styles.memoryMetric}>
      <span className={styles.memoryMetricValue}>{value ?? 0}</span>
      <span className={styles.memoryMetricLabel}>{label}</span>
    </div>
  );
}

export default function AiMemoryPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState([]);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    try {
      const response = await authFetch('/admin/ai-memory');
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) {
        setStatus(response.status === 503 ? 'unconfigured' : 'error');
        return;
      }
      const data = await response.json();
      setWorkspaces(data.workspaces || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!(await ensureSession())) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load, router]);

  if (status === 'loading') {
    return <p className={styles.state}>Carregando dados do ai-memory…</p>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>ai-memory</h1>
          <p className={styles.subtitle}>
            Visão geral das memórias e da atividade dos agentes.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            onClick={() => {
              setStatus('loading');
              load();
            }}
          >
            Atualizar
          </button>
        </div>
      </div>

      {status === 'unconfigured' ? (
        <p className={styles.state} role="status">
          Configure AI_MEMORY_URL e AI_MEMORY_AUTH_TOKEN na API para conectar o ai-memory.
        </p>
      ) : status === 'error' ? (
        <p className={styles.state} role="alert">
          Não foi possível carregar os dados do ai-memory. Verifique a conexão da API.
        </p>
      ) : workspaces.length === 0 ? (
        <p className={styles.state}>O ai-memory ainda não tem workspaces.</p>
      ) : (
        <div className={styles.memoryWorkspaces}>
          {workspaces.map((workspace) => {
            const { briefing, health } = workspace.overview;
            return (
              <section className={styles.memoryWorkspace} key={workspace.workspace_name}>
                <div className={styles.memoryWorkspaceHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>{workspace.workspace_name}</h2>
                    <p className={styles.rowMeta}>
                      Última atualização: {formatDate(workspace.last_updated)}
                    </p>
                  </div>
                  <span className={styles.badge}>
                    {workspace.project_count} {workspace.project_count === 1 ? 'projeto' : 'projetos'}
                  </span>
                </div>

                <div className={styles.memoryMetrics}>
                  <Metric label="Páginas ativas" value={briefing.counts.pages_latest} />
                  <Metric label="Sessões" value={briefing.counts.sessions} />
                  <Metric label="Observações" value={briefing.counts.observations} />
                  <Metric label="Handoffs pendentes" value={briefing.pending_handoff_count} />
                </div>

                <div className={styles.memoryActivity}>
                  <p>
                    <strong>Últimos 7 dias:</strong> {briefing.activity_7d.sessions} sessões,{' '}
                    {briefing.activity_7d.observations} observações e{' '}
                    {briefing.activity_7d.pages_updated} páginas atualizadas.
                  </p>
                  <p>
                    <strong>Saúde da wiki:</strong> {health.stale} desatualizadas,{' '}
                    {health.duplicates} duplicadas, {health.contradictions} contradições e{' '}
                    {health.orphans} sem referências.
                  </p>
                  <p>
                    <strong>Última observação:</strong> {formatDate(briefing.last_observation_at)}
                  </p>
                </div>

                {briefing.recent_pages?.length ? (
                  <div>
                    <h3 className={styles.sectionTitle}>Páginas recentes</h3>
                    <div className={styles.list}>
                      {briefing.recent_pages.map((page) => (
                        <div className={styles.row} key={page.path}>
                          <div className={styles.rowMain}>
                            <span className={styles.rowTitle}>{page.title}</span>
                            <span className={styles.rowMeta}>
                              {page.path} · {page.kind} · {formatDate(page.updated_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
