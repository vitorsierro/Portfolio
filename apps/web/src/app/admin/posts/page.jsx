'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, ensureSession } from '../../../lib/auth';
import styles from '../../../styles/Admin.module.css';
import { ROUTER_LOGIN } from '../../../constants';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PostsManager() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState(''); // o que está no input
  const [query, setQuery] = useState(''); // o que foi de fato buscado
  const [status, setStatus] = useState('loading');
  const [busyId, setBusyId] = useState(null);

  // Busca enquanto digita, esperando a pausa. Sem isso, cada tecla vira uma
  // requisição — e as respostas podem chegar fora de ordem, deixando a lista
  // mostrando o resultado de um termo antigo.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === query) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setPage(1); // um termo novo invalida a página atual
      setQuery(trimmed);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, query]);

  // Só a requisição mais recente pode escrever na tela. Digitando rápido há
  // várias em voo, e sem isto uma resposta lenta de um termo antigo chegaria
  // por último e sobrescreveria o resultado certo.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (query) params.set('q', query);

    const response = await authFetch(`/admin/posts?${params.toString()}`);
    if (requestId !== latestRequest.current) {
      return; // já existe uma busca mais nova
    }

    if (response.status === 401) {
      router.replace(ROUTER_LOGIN);
      return;
    }
    if (!response.ok) {
      setStatus('error');
      return;
    }

    const data = await response.json();
    if (requestId !== latestRequest.current) {
      return;
    }

    setPosts(data.items);
    setTotal(data.total);
    setPageCount(data.pageCount ?? 1);
    setStatus('ready');
  }, [page, query, router]);

  useEffect(() => {
    (async () => {
      const authed = await ensureSession();
      if (!authed) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      await load();
    })();
  }, [load, router]);

  // Enter aplica na hora, sem esperar o debounce.
  function onSubmit(event) {
    event.preventDefault();
    setPage(1);
    setQuery(term.trim());
  }

  // Limpar fica por conta do "x" nativo do input type=search: ele dispara
  // `input`, então o debounce recolhe a limpeza como qualquer outra edição.

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
    if (
      !window.confirm(`Excluir "${post.title}"? Esta acao nao pode ser desfeita.`)
    ) {
      return;
    }
    setBusyId(post.id);
    await authFetch(`/posts/${post.id}`, { method: 'DELETE' });
    // Excluir o último item de uma página deixaria a lista vazia; recua uma.
    if (posts.length === 1 && page > 1) {
      setPage((p) => p - 1);
    } else {
      await load();
    }
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
          <h1 className={styles.title}>Posts</h1>
          <p className={styles.subtitle}>
            {total} {total === 1 ? 'post' : 'posts'}
            {query ? ` para “${query}”` : ''}
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

      <form className={styles.searchRow} onSubmit={onSubmit} role="search">
        <input
          type="search"
          className={styles.input}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por titulo ou slug…"
          aria-label="Buscar posts"
          autoComplete="off"
        />
      </form>

      {/* Anuncia o resultado a leitores de tela: como a busca acontece
          sozinha, sem isso a mudança da lista passaria despercebida. */}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {total} {total === 1 ? 'resultado' : 'resultados'}
        {query ? ` para ${query}` : ''}
      </p>

      {posts.length === 0 ? (
        <p className={styles.state}>
          {query
            ? `Nenhum post encontrado para “${query}”.`
            : 'Nenhum post ainda. Crie o primeiro!'}
        </p>
      ) : (
        <>
          <div className={styles.list}>
            {posts.map((post) => (
              <div className={styles.row} key={post.id}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{post.title}</span>
                  <span className={styles.rowMeta}>
                    <span
                      className={`${styles.badge} ${
                        post.published
                          ? styles.badgePublished
                          : styles.badgeDraft
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

          {pageCount > 1 ? (
            <nav className={styles.pagination} aria-label="Paginacao">
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo}>
                Pagina {page} de {pageCount}
              </span>
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
              >
                Proxima →
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
