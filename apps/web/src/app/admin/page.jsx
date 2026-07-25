'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, ensureSession } from '../../lib/auth';
import { TOOLS } from '../../lib/tools';
import styles from '../../styles/Admin.module.css';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const response = await authFetch('/admin/posts?page=1&limit=100');
    if (response.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (!response.ok) {
      setStatus('error');
      return;
    }
    const data = await response.json();
    setPosts(data.items);
    setStatus('ready');
  }, [router]);

  useEffect(() => {
    (async () => {
      const authed = await ensureSession();
      if (!authed) {
        router.replace('/admin/login');
        return;
      }
      await load();
    })();
  }, [load, router]);

  async function togglePublish(post) {
    setBusyId(post.id);
    await authFetch(`/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !post.published }),
    });
    await load();
    setBusyId(null);
  }

  async function remove(post) {
    if (!window.confirm(`Excluir "${post.title}"? Esta acao nao pode ser desfeita.`)) {
      return;
    }
    setBusyId(post.id);
    await authFetch(`/posts/${post.id}`, { method: 'DELETE' });
    await load();
    setBusyId(null);
  }

  if (status === 'loading') {
    return <p className={styles.state}>Carregando…</p>;
  }
  if (status === 'error') {
    return <p className={styles.state}>Nao foi possivel carregar os posts.</p>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>Painel do blog</h1>
          <p className={styles.subtitle}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </p>
        </div>
        <div className={styles.actions}>
          <a
            className={`${styles.button} ${styles.primary}`}
            href="/admin/posts/new"
          >
            Novo post
          </a>
        </div>
      </div>

      {TOOLS.some((tool) => tool.url) ? (
        <section className={styles.tools} aria-labelledby="tools-title">
          <h2 id="tools-title" className={styles.sectionTitle}>
            Ferramentas
          </h2>
          <div className={styles.toolGrid}>
            {TOOLS.filter((tool) => tool.url).map((tool) => {
              const embedded = tool.key === 'draw';

              return (
                <a
                  className={styles.toolCard}
                  href={embedded ? '/admin/draw' : tool.url}
                  target={embedded ? undefined : '_blank'}
                  rel={embedded ? undefined : 'noreferrer'}
                  key={tool.key}
                >
                  <span className={styles.toolName}>{tool.name}</span>
                  <span className={styles.toolDescription}>
                    {tool.description}
                  </span>
                  <span className={styles.toolOpen}>
                    {embedded ? 'Abrir →' : 'Abrir em nova aba ↗'}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      <h2 className={styles.sectionTitle}>Posts</h2>

      {posts.length === 0 ? (
        <p className={styles.state}>Nenhum post ainda. Crie o primeiro!</p>
      ) : (
        <div className={styles.list}>
          {posts.map((post) => (
            <div className={styles.row} key={post.id}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{post.title}</span>
                <span className={styles.rowMeta}>
                  <span
                    className={`${styles.badge} ${
                      post.published ? styles.badgePublished : styles.badgeDraft
                    }`}
                  >
                    {post.published ? 'Publicado' : 'Rascunho'}
                  </span>{' '}
                  /{post.slug} · {formatDate(post.updatedAt)}
                </span>
              </div>
              <div className={styles.rowActions}>
                <a
                  className={styles.smallButton}
                  href={`/admin/posts/${post.id}`}
                >
                  Editar
                </a>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => togglePublish(post)}
                  disabled={busyId === post.id}
                >
                  {post.published ? 'Despublicar' : 'Publicar'}
                </button>
                <button
                  type="button"
                  className={`${styles.smallButton} ${styles.smallDanger}`}
                  onClick={() => remove(post)}
                  disabled={busyId === post.id}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
