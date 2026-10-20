 'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from '../../../../styles/ThreadReader.module.css';
import { threadRequest } from '../../../../lib/threadApi';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { dateStyle: 'medium' });
}

export default function SavedThreadsPage() {
  const [threads, setThreads] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const dialogRef = useRef(null);
  const titleInputRef = useRef(null);
  const editTriggerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      titleInputRef.current?.focus();
      return;
    }
    const trigger = editTriggerRef.current;
    if (!trigger) return;
    if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    else searchInputRef.current?.focus();
    editTriggerRef.current = null;
  }, [editing]);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await threadRequest('/admin/threads');
      setThreads(Array.isArray(data) ? data : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as threads salvas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return threads;
    return threads.filter((thread) =>
      [thread.title, thread.authorName, thread.authorHandle, thread.preview]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term)),
    );
  }, [search, threads]);

  async function editThread(id, event) {
    setError('');
    editTriggerRef.current = event.currentTarget;
    try {
      const data = await threadRequest(`/admin/threads/${encodeURIComponent(id)}`);
      setEditing({ ...data, posts: data.posts.map((post) => ({ ...post })) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a edição.');
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await threadRequest(`/admin/threads/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editing.title, posts: editing.posts }),
      });
      setEditing(null);
      await loadThreads();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a thread.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteThread(id) {
    setBusy(true);
    setError('');
    try {
      await threadRequest(`/admin/threads/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setThreads((current) => current.filter((thread) => thread.id !== id));
      setDeletingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir a thread.');
    } finally {
      setBusy(false);
    }
  }

  function updatePost(index, text) {
    setEditing((current) => {
      if (!current) return current;
      const posts = current.posts.map((post, postIndex) =>
        postIndex === index ? { ...post, text } : post,
      );
      return { ...current, posts };
    });
  }

  function handleDialogKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!busy) setEditing(null);
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;

    const focusable = Array.from(dialogRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.kicker}>Arquivo pessoal · Gerenciar</p>
          <h1 className={styles.title}>Sua biblioteca de threads.</h1>
          <p className={styles.subtitle}>Leia, ajuste o título ou os posts e remova o que não quiser guardar.</p>
        </div>
        <div className={styles.mastheadActions}>
          <Link className={styles.quietLink} href="/admin/threads">Importar uma thread →</Link>
        </div>
      </header>

      <div className={styles.managerToolbar}>
        <label className={styles.searchWrap} htmlFor="thread-search">
          <span className={styles.searchLabel}>Buscar na biblioteca</span>
          <input
            id="thread-search"
            className={styles.searchInput}
            type="search"
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Título, autor ou trecho…"
          />
        </label>
        <p className={styles.smallNote}>{filteredThreads.length} de {threads.length} threads</p>
      </div>

      {error && <p className={`${styles.message} ${styles.errorMessage}`} role="alert">{error}</p>}
      {loading && <p className={styles.loadingState}>Carregando biblioteca…</p>}
      {!loading && !threads.length && (
        <section className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Ainda não há threads salvas.</h2>
          <p>Importe um post do X e use o botão no fim da leitura para guardá-lo aqui.</p>
          <Link className={styles.primaryButton} href="/admin/threads">Importar primeira thread</Link>
        </section>
      )}
      {!loading && threads.length > 0 && !filteredThreads.length && (
        <section className={styles.emptyState}><h2 className={styles.emptyTitle}>Nada encontrado.</h2><p>Tente outro nome, autor ou trecho.</p></section>
      )}
      {!loading && filteredThreads.length > 0 && (
        <div className={styles.savedList}>
          {filteredThreads.map((thread) => (
            <article className={styles.savedCard} key={thread.id}>
              <div className={styles.savedCardTop}>
                <div>
                  <h2 className={styles.savedCardTitle}>{thread.title}</h2>
                  <div className={styles.savedCardMeta}>
                    <span>{thread.authorName || 'Autor do X'} {thread.authorHandle}</span>
                    <span>{thread.postCount} posts</span>
                    <span>Salva em {formatDate(thread.updatedAt)}</span>
                  </div>
                </div>
                <a className={styles.sourceLink} href={thread.sourceUrl} target="_blank" rel="noreferrer">Origem ↗</a>
              </div>
              <p className={styles.savedPreview}>{thread.preview}</p>
              <div className={styles.savedCardActions}>
                <Link className={styles.cardLink} href={`/admin/threads/saved/${thread.id}`}>Ler thread</Link>
                <button className={styles.cardLink} type="button" onClick={(event) => editThread(thread.id, event)}>Editar</button>
                <button className={styles.dangerButton} type="button" onClick={() => setDeletingId(thread.id)}>Excluir</button>
              </div>
              {deletingId === thread.id && (
                <div className={styles.deleteConfirm} role="group" aria-label={`Confirmar exclusão de ${thread.title}`}>
                  <span>Excluir esta thread da biblioteca?</span>
                  <span className={styles.savedCardActions}>
                    <button className={styles.dangerButton} type="button" onClick={() => deleteThread(thread.id)} disabled={busy}>Sim, excluir</button>
                    <button className={styles.secondaryButton} type="button" onClick={() => setDeletingId(null)} disabled={busy}>Cancelar</button>
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className={styles.modalOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditing(null); }}>
          <form ref={dialogRef} className={styles.editDialog} role="dialog" aria-modal="true" aria-labelledby="edit-thread-title" onKeyDown={handleDialogKeyDown} onSubmit={saveEdit}>
            <header className={styles.modalHeader}>
              <div><p className={styles.kicker}>Editar thread salva</p><h2 id="edit-thread-title">Revise o título e os posts.</h2></div>
              <button className={styles.secondaryButton} type="button" onClick={() => setEditing(null)} disabled={busy} aria-label="Fechar edição">Fechar</button>
            </header>
            <div className={styles.modalBody}>
              <label className={styles.fieldLabel} htmlFor="edit-thread-name">Título
                <input ref={titleInputRef} id="edit-thread-name" className={styles.titleInput} maxLength={300} required value={editing.title} onChange={(event) => setEditing((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <div className={styles.editPosts}>
                {editing.posts.map((post, index) => (
                  <label className={styles.editPost} key={`${index}-${post.text.slice(0, 24)}`}>
                    <span className={styles.searchLabel}>Post {index + 1}</span>
                    <textarea className={styles.postTextarea} required maxLength={30000} value={post.text} onChange={(event) => updatePost(index, event.target.value)} />
                  </label>
                ))}
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={() => setEditing(null)} disabled={busy}>Cancelar</button>
              <button className={styles.primaryButton} type="submit" disabled={busy || !editing.title.trim()}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
