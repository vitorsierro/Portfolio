 'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from '../../../styles/ThreadReader.module.css';
import { threadRequest } from '../../../lib/threadApi';

export default function ThreadImportPage() {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState('');
  const [thread, setThread] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function importThread(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setThread(null);
    try {
      const imported = await threadRequest('/admin/threads/import', {
        method: 'POST',
        body: JSON.stringify({ sourceUrl }),
      });
      const defaultTitle = (imported.title || 'Thread do X').trim();
      setThread({
        ...imported,
        title: defaultTitle.length > 300 ? `${defaultTitle.slice(0, 297)}…` : defaultTitle,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar essa thread.');
    } finally {
      setBusy(false);
    }
  }

  async function saveThread() {
    if (!thread) return;
    setBusy(true);
    setError('');
    try {
      const saved = await threadRequest('/admin/threads', {
        method: 'POST',
        body: JSON.stringify(thread),
      });
      router.push(`/admin/threads/saved/${saved.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar essa thread.');
      setBusy(false);
    }
  }

  function updateTitle(value) {
    setThread((current) => (current ? { ...current, title: value } : current));
  }

  return (
    <main className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.kicker}>Arquivo pessoal · X</p>
          <h1 className={styles.title}>Threads, sem a timeline.</h1>
          <p className={styles.subtitle}>
            Cole o link de um post para reunir a conversa numa leitura contínua. Revise e salve
            quando chegar ao fim.
          </p>
        </div>
        <div className={styles.mastheadActions}>
          <Link className={styles.quietLink} href="/admin/threads/saved">Biblioteca salva →</Link>
        </div>
      </header>

      <section className={styles.panel} aria-label="Importar uma thread">
        <form className={styles.importForm} onSubmit={importThread}>
          <label className={styles.fieldLabel} htmlFor="thread-source-url">
            Link do X ou do leitor de threads
          </label>
          <div className={styles.inputRow}>
              <input
                id="thread-source-url"
                className={styles.textInput}
                type="url"
                required
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://x.com/usuario/status/…"
                autoComplete="url"
              />
              <button className={styles.primaryButton} type="submit" disabled={busy}>
                {busy ? 'Carregando…' : 'Abrir thread'}
              </button>
          </div>
          <p className={styles.formHint}>
            Aceita links de x.com, twitter.com e twitter-thread.com. A importação depende do
            leitor público de threads estar acessível.
          </p>
        </form>
        {error && <p className={`${styles.message} ${styles.errorMessage}`} role="alert">{error}</p>}
      </section>

      {thread && (
        <article className={styles.thread}>
          <header className={styles.threadHeader}>
            <p className={styles.kicker}>Prévia · {thread.posts.length} posts</p>
            <label className={styles.fieldLabel} htmlFor="thread-title">
              Título para sua biblioteca
              <input
                id="thread-title"
                className={styles.threadTitleInput}
                maxLength={300}
                value={thread.title}
                onChange={(event) => updateTitle(event.target.value)}
              />
            </label>
            <div className={styles.threadMeta}>
              <span className={styles.authorLine}>
                {thread.authorName || 'Autor do X'} {thread.authorHandle}
              </span>
              <a className={styles.sourceLink} href={thread.sourceUrl} target="_blank" rel="noreferrer">
                Abrir post original ↗
              </a>
            </div>
          </header>

          <div className={styles.postList}>
            {thread.posts.map((post, index) => (
              <section className={styles.post} key={`${index}-${post.text.slice(0, 32)}`}>
                <span className={styles.postIndex} aria-label={`Post ${index + 1}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className={styles.postText}>{post.text}</p>
                  {post.mediaUrls?.length > 0 && (
                    <div className={styles.postMedia}>
                      {post.mediaUrls.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={styles.postImage} key={url} src={url} alt={`Mídia do post ${index + 1}`} loading="lazy" />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>

          <footer className={styles.saveFooter}>
            <p className={styles.endMark}>Fim da thread · {thread.posts.length} posts</p>
            <p className={styles.formHint}>Quer voltar a esta leitura depois? Salve na sua biblioteca privada.</p>
            <button className={styles.primaryButton} type="button" onClick={saveThread} disabled={busy || !thread.title.trim()}>
              {busy ? 'Salvando…' : 'Salvar thread para ler depois'}
            </button>
          </footer>
        </article>
      )}
    </main>
  );
}
