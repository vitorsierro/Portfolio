 'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from '../../../styles/ThreadReader.module.css';
import { threadRequest } from '../../../lib/threadApi';
import { newsReading, readingPayload, readingType } from '../../../lib/readings';

export default function UnifiedReaderPage() {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState('');
  const [thread, setThread] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isNews = thread && readingType(thread.sourceUrl) === 'news';

  async function importThread(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setThread(null);
    try {
      const kind = readingType(sourceUrl);
      const response = await threadRequest(kind === 'thread' ? '/admin/threads/import' : '/admin/news/import', {
        method: 'POST',
        body: JSON.stringify({ sourceUrl }),
      });
      const imported = kind === 'news' ? newsReading(response) : response;
      const defaultTitle = (imported.title || 'Minha leitura').trim();
      setThread({
        ...imported,
        title: defaultTitle.length > 300 ? `${defaultTitle.slice(0, 297)}…` : defaultTitle,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir essa leitura.');
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
        body: JSON.stringify(readingPayload(thread)),
      });
      router.push(`/admin/reader/saved/${saved.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar essa leitura.');
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
          <p className={styles.kicker}>Arquivo pessoal · Threads e notícias</p>
          <h1 className={styles.title}>Suas leituras, em um só lugar.</h1>
          <p className={styles.subtitle}>
            Cole um link do X ou de uma notícia. Leia sem distrações e salve na sua biblioteca.
          </p>
        </div>
        <div className={styles.mastheadActions}>
          <Link className={styles.quietLink} href="/admin/reader/saved">Biblioteca salva →</Link>
        </div>
      </header>

      <section className={styles.panel} aria-label="Abrir uma leitura">
        <form className={styles.importForm} onSubmit={importThread}>
          <label className={styles.fieldLabel} htmlFor="thread-source-url">
            Link de uma thread ou notícia
          </label>
          <div className={styles.inputRow}>
              <input
                id="thread-source-url"
                className={styles.textInput}
                type="url"
                required
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="Cole o link do X ou de um site de notícias"
                maxLength={2048}
                autoComplete="url"
              />
              <button className={styles.primaryButton} type="submit" disabled={busy}>
                {busy ? 'Preparando leitura…' : 'Abrir leitura'}
              </button>
          </div>
          <p className={styles.formHint}>
            Threads do X são reunidas e traduzidas para português, com o original preservado.
            Notícias de UOL, Folha, Globo, Estadão, CNN Brasil e BBC usam o texto disponível na página.
          </p>
        </form>
        {error && !thread && <p className={`${styles.message} ${styles.errorMessage}`} role="alert">{error}</p>}
      </section>

      {thread && (
        <article className={styles.thread}>
          <header className={styles.threadHeader}>
            <p className={styles.kicker}>{isNews ? 'Notícia' : `Thread · ${thread.posts.length} posts`} · Prévia</p>
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
                {thread.authorName || new URL(thread.sourceUrl).hostname} {thread.authorHandle}
              </span>
              <a className={styles.sourceLink} href={thread.sourceUrl} target="_blank" rel="noreferrer">
                Abrir fonte original ↗
              </a>
            </div>
            {isNews && thread.restricted && <p className={styles.formHint}>Esta matéria é marcada como exclusiva pelo site. Trechos que não foram enviados pela fonte podem estar ausentes.</p>}
          </header>

          <div className={styles.postList}>
            {thread.posts.map((post, index) => (
              <section className={isNews ? undefined : styles.post} key={`${index}-${post.text.slice(0, 32)}`}>
                {!isNews && <span className={styles.postIndex} aria-label={`Post ${index + 1}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>}
                <div>
                  <p className={styles.postText}>{post.text}</p>
                  {post.originalText && <details><summary>Ver original</summary><p className={styles.postText} dir="auto">{post.originalText}</p></details>}
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
            {error && <p className={`${styles.message} ${styles.errorMessage}`} role="alert">{error}</p>}
            <p className={styles.endMark}>Fim da leitura{!isNews && ` · ${thread.posts.length} posts`}</p>
            <p className={styles.formHint}>Quer voltar a esta leitura depois? Salve na sua biblioteca privada.</p>
            <button className={styles.primaryButton} type="button" onClick={saveThread} disabled={busy || !thread.title.trim()}>
              {busy ? 'Salvando…' : 'Salvar na biblioteca'}
            </button>
          </footer>
        </article>
      )}
    </main>
  );
}
