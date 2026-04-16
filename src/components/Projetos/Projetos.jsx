import dados from "../../../dados.json";
import styles from "../../styles/Projetos.module.css";

export default function Projetos() {
  const projetos = dados.projetos;

  return (
    <section
      id="project"
      className={styles.section}
      aria-labelledby="projects-title"
    >
      <div className={styles.sectionHeader}>
        <p className={styles.eyebrow}>Projetos em destaque</p>
        <h2 id="projects-title" className={styles.title}>
          Projetos
        </h2>
        <p className={styles.description}>
          Uma selecao dos trabalhos mais relevantes, com links para a versao
          publicada e para a estrutura de codigo.
        </p>
      </div>

      <div className={styles.grid}>
        {projetos.map(
          ({ titulo, empresa, link, link2, img, conteudo, tags }, key) => {
            const projectLink = link || link2;

            return (
              <article className={styles.cardShell} key={`${titulo}-${key}`}>
                <a
                  className={styles.card}
                  href={projectLink}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir projeto ${titulo}`}
                >
                  <div className={styles.imageFrame}>
                    <img
                      src={img}
                      alt={`Preview do projeto ${titulo}`}
                      className={styles.image}
                    />
                  </div>

                  <div className={styles.cardBody}>
                    {empresa ? (
                      <p className={styles.company}>{empresa}</p>
                    ) : null}
                    <h3>{titulo}</h3>
                    <p className={styles.copy}>{conteudo}</p>

                    <ul
                      className={styles.tagList}
                      aria-label={`Tecnologias de ${titulo}`}
                    >
                      {tags.map((tag) => (
                        <li className={styles.tag} key={`${titulo}-${tag}`}>
                          {tag}
                        </li>
                      ))}
                    </ul>

                    <div className={styles.linkRow}>
                      <span className={styles.primaryLink}>Abrir projeto</span>
                       {link2 ? (
                      <a
                        className={styles.secondaryLink}
                        href={link2}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver estrutura
                      </a>
                    ) : null}
                    </div>
                   
                  </div>
                </a>
              </article>
            );
          },
        )}
      </div>
    </section>
  );
}
