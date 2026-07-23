import styles from '../../styles/Certificados.module.css';

export default function Certificados({ certificados, cursos }) {
  return (
    <section id="certificados" className={styles.section} aria-labelledby="certificates-title">
      <div className={styles.sectionHeader}>
        <p className={styles.eyebrow}>Formacao e aprendizado continuo</p>
        <h2 id="certificates-title" className={styles.title}>
          Certificados
        </h2>
      </div>

      <div className={styles.grid}>
        {certificados.map(({ titulo, empresa, link, img }, key) => (
          <article className={styles.cardShell} key={`${titulo}-${key}`}>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className={styles.card}
              aria-label={`Abrir certificado ${titulo}`}
            >
              <div className={styles.imageFrame}>
                <img src={img} alt={`Certificado ${titulo}`} className={styles.image} />
              </div>
              <div className={styles.cardBody}>
                <p className={styles.company}>{empresa}</p>
                <h3>{titulo}</h3>
                <span className={styles.link}>Ver certificado</span>
              </div>
            </a>
          </article>
        ))}
      </div>

      <div className={styles.courseHeader} id="cursos">
        <p className={styles.eyebrow}>Habilidades desenvolvidas</p>
        <h2 className={styles.title}>Cursos</h2>
      </div>

      <div className={styles.grid}>
        {cursos.map(({ titulo, empresa, link, img, conteudo }, key) => (
          <article className={styles.cardShell} key={`${titulo}-${key}`}>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className={styles.card}
              aria-label={`Abrir curso ${titulo}`}
            >
              <div className={styles.imageFrame}>
                <img src={img} alt={`Curso ${titulo}`} className={styles.image} />
              </div>
              <div className={styles.cardBody}>
                <p className={styles.company}>{empresa}</p>
                <h3>{titulo}</h3>
                <p className={styles.copy}>{conteudo}</p>
                <span className={styles.link}>Ver detalhes</span>
              </div>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
