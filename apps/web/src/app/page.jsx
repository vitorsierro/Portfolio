import Header from '../components/Header/Header';
import Conteudo from '../components/Conteudo/Conteudo';
import Footer from '../components/Footer/Footer';
import { getPortfolioData } from '../lib/api';
import styles from '../styles/Home.module.css';

export default async function Home() {
  const dados = await getPortfolioData();

  return (
    <div className={styles.page}>
      <Header />
      <Conteudo
        projetos={dados.projetos}
        experiencias={dados.Experiencia_Profissional}
        certificados={dados.CERTIFICACAO}
        cursos={dados.CURSOS}
        dadosPessoais={dados.DADOS_PESSOAIS[0]}
      />
      <Footer />
    </div>
  );
}
