import Certificados from '../Certificado/Certificados';
import Experiencia from '../Experiencia/Experiencia';
import Projetos from '../Projetos/Projetos';
import Sobre from '../Sobre/Sobre';
import styles from '../../styles/Home.module.css';

export default function Conteudo({ projetos, experiencias, certificados, cursos, dadosPessoais }) {
  return (
    <main className={styles.main}>
      <Projetos projetos={projetos} />
      <Experiencia experiencias={experiencias} />
      <Certificados certificados={certificados} cursos={cursos} />
      <Sobre dadosPessoais={dadosPessoais} />
    </main>
  );
}
