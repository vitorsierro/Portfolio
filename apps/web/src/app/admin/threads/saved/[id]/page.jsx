 'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from '../../../../../styles/ThreadReader.module.css';
import { threadRequest } from '../../../../../lib/threadApi';
import { readingType } from '../../../../../lib/readings';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { dateStyle: 'long' });
}

export default function SavedThreadReaderPage() {
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isNews = thread && readingType(thread.sourceUrl) === 'news';

  useEffect(() => {
    let active = true;
    async function loadThread() {
      setLoading(true);
      setError('');
      try {
        const data = await threadRequest(`/admin/threads/${encodeURIComponent(id)}`);
        if (active) setThread(data);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir essa leitura.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) loadThread();
    return () => { active = false; };
  }, [id]);

  return (
    <main className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.kicker}>Biblioteca · Leitura</p>
          <h1 className={styles.title}>Seu espaço de leitura.</h1>
        </div>
        <div className={styles.mastheadActions}>
          <Link className={styles.quietLink} href="/admin/reader/saved">← Gerenciar salvos</Link>
        </div>
      </header>

      {loading && <p className={styles.loadingState}>Abrindo a leitura…</p>}
      {error && <p className={`${styles.message} ${styles.errorMessage}`} role="alert">{error}</p>}
      {!loading && !error && thread && (
        <article className={styles.readArticle}>
          <header className={styles.threadHeader}>
            <p className={styles.kicker}>{isNews ? 'Notícia' : `Thread · ${thread.posts.length} posts`} · Salva em {formatDate(thread.createdAt)}</p>
            <h2 className={styles.readerTitle}>{thread.title}</h2>
            <div className={styles.threadMeta}>
              <span className={styles.authorLine}>{thread.authorName || new URL(thread.sourceUrl).hostname} {thread.authorHandle}</span>
              <a className={styles.sourceLink} href={thread.sourceUrl} target="_blank" rel="noreferrer">
                Ver origem ↗
              </a>
            </div>
            {isNews && <p className={styles.formHint}>Texto disponibilizado pela fonte no momento da importação. Trechos restritos podem estar ausentes.</p>}
          </header>

          <div className={styles.readerBody}>
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

          <footer className={styles.readerFooter}>
            <span className={styles.smallNote}>Fim da leitura</span>
            <Link className={styles.cardLink} href="/admin/reader/saved">Voltar à biblioteca</Link>
          </footer>
        </article>
      )}
    </main>
  );
}
