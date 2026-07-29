import Image from 'next/image';
import styles from '../../styles/Sobre.module.css';

// Os icones sociais tem tamanho fixo (1.5rem no CSS), entao aqui dao para ir
// com width/height reais em vez de `fill` — sem wrapper posicionado.
const ICON_SIZE = 24;

export default function Sobre({ dadosPessoais }) {
  const { nome, cargo, email, sobre_mim: sobreMim, links = [] } = dadosPessoais;

  return (
    <section id="sobre" className={styles.section} aria-labelledby="about-title">
      <div className={styles.sectionHeader}>
        <p className={styles.eyebrow}>Quem sou eu</p>
        <h2 id="about-title" className={styles.title}>
          Sobre
        </h2>
      </div>

      <article className={styles.card}>
        <div className={styles.content}>
          <p className={styles.kicker}>Perfil profissional</p>
          <h3 className={styles.name}>{nome}</h3>
          <p className={styles.role}>{cargo}</p>
          <a href={`mailto:${email}`} className={styles.email}>
            {email}
          </a>
          <p className={styles.copy}>{sobreMim}</p>
        </div>

        <div className={styles.socialBlock}>
          <p className={styles.socialLabel}>Links importantes</p>
          <ul className={styles.socialList}>
            {links.map(({ link, img, alt }) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer" className={styles.socialLink}>
                  <Image
                    src={img}
                    alt={alt}
                    className={styles.socialIcon}
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  );
}
