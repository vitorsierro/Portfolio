import { notFound } from 'next/navigation';
import Header from '../../../../components/Header/Header';
import Footer from '../../../../components/Footer/Footer';
import { getPost } from '../../../../lib/blog';
import homeStyles from '../../../../styles/Home.module.css';
import styles from '../../../../styles/Post.module.css';

function plainText(html, max = 160) {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: 'Post nao encontrado | Vitor Sierro' };
  }

  const description = plainText(post.bodyHtml);

  return {
    title: `${post.title} | Blog Vitor Sierro`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.publishedAt ?? undefined,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const date = formatDate(post.publishedAt);

  return (
    <div className={homeStyles.page}>
      <Header />
      <main className={homeStyles.main}>
        <article className={styles.article}>
          <a href="/blog" className={styles.back}>
            ← Voltar ao blog
          </a>

          <header className={styles.header}>
            {date ? <p className={styles.meta}>{date}</p> : null}
            <h1 className={styles.title}>{post.title}</h1>
            {post.tags?.length > 0 ? (
              <ul className={styles.tagList} aria-label="Tags">
                {post.tags.map((tag) => (
                  <li className={styles.tag} key={tag}>
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </header>

          {post.coverImageUrl ? (
            <div className={styles.cover}>
              {/* <img> de proposito — mesmo motivo do BlogList: coverImageUrl e
                  URL livre digitada no CMS, e o next/image rejeitaria host
                  fora de images.remotePatterns com 400. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.coverImageUrl} alt={`Capa do post ${post.title}`} />
            </div>
          ) : null}

          <div
            className={styles.prose}
            // Sanitized on the API before it ever reaches the client.
            dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
          />
        </article>
      </main>
      <Footer />
    </div>
  );
}
