import Cabecalho from '../components/Head/Cabecalho';
import Header from '../components/Header/Header';
import Conteudo from '../components/Conteudo/Conteudo';
import Footer from '../components/Footer/Footer';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <Cabecalho />
      <Header />
      <Conteudo />
      <Footer />
    </div>
  );
}
