import styles from '../../styles/Experiencia.module.css';

export default function Experiencia({ experiencias }) {
  return (
    <section id="experiencia" className={styles.section} aria-labelledby="experience-title">
      <div className={styles.sectionHeader}>
        <p className={styles.eyebrow}>Trajetoria profissional</p>
        <h2 id="experience-title" className={styles.title}>
          Experiencia profissional
        </h2>
      </div>

      <div className={styles.list}>
        {experiencias.map(({ cargo, empresa, conteudo, link, datas, tecnologias }, key) => (
          <article className={styles.card} key={`${empresa}-${key}`}>
            <div className={styles.topLine}>
              <h3>{cargo}</h3>
              <p className={styles.period}>{datas}</p>
            </div>

            <a href={link} target="_blank" rel="noreferrer" className={styles.companyLink}>
              {empresa}
            </a>

            <p className={styles.copy}>{conteudo}</p>

            {tecnologias.length > 0 && (
              <ul className={styles.tagList} aria-label={`Tecnologias usadas em ${empresa}`}>
                {tecnologias.map((tecnologia) => (
                  <li className={styles.tag} key={`${empresa}-${tecnologia}`}>
                    {tecnologia}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
