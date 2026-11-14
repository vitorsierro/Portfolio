'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../../lib/auth';
import { ROUTER_LOGIN } from '../../../constants';
import admin from '../../../styles/Admin.module.css';
import styles from './page.module.css';

const date = (value) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
  : 'Ainda sem registro';
const deploymentStatus = (value) => ({ finished: 'Concluído', in_progress: 'Em andamento', queued: 'Na fila', failed: 'Falhou', 'cancelled-by-user': 'Cancelado' })[value] || 'Pendente';

export default function CoolifyPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async (signal) => {
    try {
      const response = await authFetch('/admin/coolify', { signal });
      if (response.status === 401) { router.replace(ROUTER_LOGIN); return; }
      if (!response.ok) throw new Error('Monitor indisponível');
      const snapshot = await response.json();
      if (!signal?.aborted) { setData(snapshot); setError(false); }
    } catch (e) {
      if (e.name !== 'AbortError' && !signal?.aborted) setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const interval = setInterval(() => { if (!document.hidden) load(controller.signal); }, 30_000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [load]);

  const services = data?.services || [];
  const healthy = services.filter((s) => s.state === 'running' && s.health === 'healthy').length;
  const updates = data?.updates;
  const panelUrl = data?.panelUrl || 'http://127.0.0.1:8000/';
  const localPanel = ['127.0.0.1', 'localhost'].includes(new URL(panelUrl).hostname);

  return (
    <main className={admin.page}>
      <header className={admin.topbar}>
        <div><h1 className={admin.title}>Coolify</h1><p className={admin.subtitle}>Serviços e deploys da VPS em um só lugar.</p></div>
        <div className={admin.actions}>
          <button className={`${admin.button} ${admin.secondary}`} disabled={loading} onClick={() => { setLoading(true); load(); }}>Atualizar</button>
          <a className={`${admin.button} ${admin.primary}`} href={panelUrl} target="_blank" rel="noreferrer">Abrir painel completo ↗</a>
        </div>
      </header>

      {localPanel && <details className={styles.connection}>
        <summary>Como conectar ao painel completo</summary>
        <p>Abra a conexão SSH neste computador e depois use o botão acima. Entre com sua conta do Coolify.</p>
        <code>ssh -N -L 8000:127.0.0.1:8000 portfolio-admin-security</code>
      </details>}

      {error && <p className={styles.warning} role="alert">Não foi possível atualizar o monitor. {data ? 'Exibindo a última leitura recebida.' : 'Tente novamente em instantes.'}</p>}
      {data?.stale && <p className={styles.warning} role="alert">A coleta está atrasada. Estes dados podem estar desatualizados.</p>}
      {data && !data.coolifyAvailable && <p className={styles.warning} role="alert">O Coolify não respondeu à última coleta. Os dados dos containers continuam disponíveis.</p>}
      {loading && !data && <p className={admin.state} role="status">Carregando serviços…</p>}

      {data && <>
        <section className={styles.summary} aria-label="Resumo da VPS">
          <div className={styles.metric}><strong>{healthy}<small> / {services.length}</small></strong><span>Serviços saudáveis</span></div>
          <div className={styles.metric}><strong>{updates?.enabled ? 'Ativas' : 'Desativadas'}</strong><span>Atualizações automáticas</span></div>
          <div className={styles.metric}><strong className={styles.timestamp}>{date(data.collectedAt)}</strong><span>Última coleta · Brasília</span></div>
        </section>

        <section className={styles.panel} aria-labelledby="services-heading">
          <h2 id="services-heading">Serviços</h2>
          <div className={styles.services}>
            {services.map((service) => {
              const ok = service.state === 'running' && service.health === 'healthy';
              const version = service.version || (service.name === 'hermes' ? updates?.hermesVersion : service.name === 'ai-memory' ? updates?.memoryVersion : null);
              return <article key={service.name} className={styles.service}>
                <div className={styles.serviceHeader}><h3>{service.name}</h3><span className={ok ? styles.healthy : styles.attention}>{ok ? 'Saudável' : service.health === 'unhealthy' ? 'Com falha' : service.state === 'running' ? 'Verificando' : 'Parado'}{version && ` · v${version}`}</span></div>
                <dl className={styles.stats}><div><dt>CPU</dt><dd>{service.cpu || '—'}</dd></div><div><dt>Memória / limite</dt><dd>{service.memory || '—'}</dd></div><div><dt>Reinícios</dt><dd>{service.restarts}</dd></div></dl>
                <p className={styles.muted}>Último início: {date(service.startedAt)}</p>
              </article>;
            })}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="updates-heading">
          <h2 id="updates-heading">Atualizações dos agentes</h2>
          <div className={styles.versions}><span>Hermes <strong>{updates?.hermesVersion || '—'}</strong></span><span>ai-memory <strong>{updates?.memoryVersion || '—'}</strong></span></div>
          <p>Verificação diária das versões estáveis às 04h de Brasília, com até 15 minutos de variação. Atualizações passam por cópias de segurança e verificações antes da publicação.</p>
          <dl className={styles.schedule}><div><dt>Última execução</dt><dd>{date(updates?.lastCheck)} · {updates?.result === 'success' ? 'Concluída' : 'Requer atenção'}</dd></div><div><dt>Próxima verificação</dt><dd>{date(updates?.nextCheck)}</dd></div></dl>
        </section>

        <section className={styles.panel} aria-labelledby="deployments-heading">
          <h2 id="deployments-heading">Últimos deploys</h2>
          {data.deployments.length ? <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Estado</th><th>Commit</th><th>Iniciado em · Brasília</th></tr></thead><tbody>{data.deployments.map((deployment, i) => <tr key={`${deployment.createdAt}-${i}`}><td>{deploymentStatus(deployment.status)}</td><td><code>{deployment.commit?.slice(0, 7) || '—'}</code></td><td>{date(deployment.createdAt)}</td></tr>)}</tbody></table></div> : <p className={styles.muted}>Nenhum deploy disponível nesta coleta.</p>}
        </section>
      </>}
    </main>
  );
}
