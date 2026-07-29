import Image from "next/image";
import styles from "../../styles/Projetos.module.css";

export default function Projetos({ projetos }) {
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
                <div className={styles.card}>
                  <div className={styles.imageFrame}>
                    {/* `fill` porque as capas vem do JSON sem dimensoes; quem
                        define o formato e o aspect-ratio do .imageFrame. */}
                    <Image
                      src={img}
                      alt={`Preview do projeto ${titulo}`}
                      className={styles.image}
                      fill
                      sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
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
                      <a
                        className={styles.primaryLink}
                        href={projectLink}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir projeto ${titulo}`}
                      >
                        Abrir projeto
                      </a>
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
                </div>
              </article>
            );
          },
        )}
      </div>
    </section>
  );
}
