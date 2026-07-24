'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../../styles/Blog.module.css';

const CLIENT_API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 9;

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function PostCard({ post }) {
  const date = formatDate(post.publishedAt);

  return (
    <article className={styles.cardShell}>
      <a className={styles.card} href={`/blog/post/${post.slug}`}>
        {post.coverImageUrl ? (
          <div className={styles.imageFrame}>
            <img
              src={post.coverImageUrl}
              alt={`Capa do post ${post.title}`}
              className={styles.image}
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className={`${styles.imageFrame} ${styles.imagePlaceholder}`}
            aria-hidden="true"
          />
        )}

        <div className={styles.cardBody}>
          {date ? <p className={styles.meta}>{date}</p> : <span />}
          <h2 className={styles.cardTitle}>{post.title}</h2>
          <p className={styles.excerpt}>{post.excerpt}</p>

          {post.tags?.length > 0 ? (
            <ul className={styles.tagList} aria-label={`Tags de ${post.title}`}>
              {post.tags.map((tag) => (
                <li className={styles.tag} key={tag}>
                  {tag}
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}

          <span className={styles.readMore}>Ler post →</span>
        </div>
      </a>
    </article>
  );
}

export default function BlogList({ initialItems, initialCursor }) {
  const [items, setItems] = useState(initialItems ?? []);
  const [cursor, setCursor] = useState(initialCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const sentinelRef = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading || !cursor) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        cursor,
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(`${CLIENT_API_URL}/posts?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      const data = await response.json();
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      setError('Nao foi possivel carregar mais posts. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !cursor) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [loadMore, cursor]);

  if (items.length === 0) {
    return <p className={styles.empty}>Nenhum post publicado ainda.</p>;
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}{' '}
          <button type="button" onClick={loadMore} className={styles.readMore}>
            Tentar novamente
          </button>
        </p>
      ) : null}

      {cursor ? (
        <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true">
          {loading ? 'Carregando…' : ''}
        </div>
      ) : null}
    </>
  );
}
