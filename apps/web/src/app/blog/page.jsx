import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import BlogList from '../../components/BlogList/BlogList';
import { getPosts } from '../../lib/blog';
import homeStyles from '../../styles/Home.module.css';
import styles from '../../styles/Blog.module.css';

export const metadata = {
  title: 'Blog | Vitor Sierro',
  description:
    'Artigos e anotacoes sobre desenvolvimento, tecnologia e os bastidores dos meus projetos.',
};

export default async function BlogPage() {
  const { items, nextCursor } = await getPosts();

  return (
    <div className={homeStyles.page}>
      <Header />
      <main className={homeStyles.main}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Blog</p>
            <h1 className={styles.title}>Escritos &amp; anotacoes</h1>
            <p className={styles.description}>
              Pensamentos sobre desenvolvimento, tecnologia e os bastidores dos
              meus projetos.
            </p>
          </div>

          <BlogList initialItems={items} initialCursor={nextCursor} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
