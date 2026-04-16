import Certificados from '../Certificado/Certificados';
import Experiencia from '../Experiencia/Experiencia';
import Projetos from '../Projetos/Projetos';
import Sobre from '../Sobre/Sobre';
import styles from '../../styles/Home.module.css';

export default function Conteudo() {
  return (
    <main className={styles.main}>
      <Projetos />
      <Experiencia />
      <Certificados />
      <Sobre />
    </main>
  );
}
